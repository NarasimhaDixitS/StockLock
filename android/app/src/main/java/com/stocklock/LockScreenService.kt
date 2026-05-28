// android/app/src/main/java/com/stocklock/LockScreenService.kt
package com.stocklock

import android.app.*
import android.content.*
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class LockScreenService : Service() {

    data class TrackedInstrument(
        val name: String,
        val symbol: String,
        val type: String
    )

    data class QuoteData(
        val name: String,
        val symbol: String,
        val type: String,
        val price: Double,
        val changePercent: Double
    )

    companion object {
        const val ACTION_SET_TRACKED_SYMBOLS = "com.stocklock.SET_TRACKED_SYMBOLS"
        const val CHANNEL_ID = "StockLockChannel"
        const val NOTIFICATION_ID = 1001

        val DEFAULT_TRACKED = mutableListOf(
            TrackedInstrument("NIFTY 50", "^NSEI", "index"),
            TrackedInstrument("ADANIGREEN", "ADANIGREEN.NS", "stock")
        )
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private lateinit var rowsContainer: LinearLayout
    private lateinit var lastUpdatedText: TextView
    private lateinit var overlayRoot: LinearLayout

    private val httpClient = OkHttpClient()
    private val trackedInstruments = mutableListOf<TrackedInstrument>()
    private var monochromeMode = false

    private val handler = Handler(Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            fetchStockData()
            handler.postDelayed(this, 60_000L) // refresh every 60 seconds
        }
    }

    private val serviceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_SET_TRACKED_SYMBOLS -> {
                    val symbolsJson = intent.getStringExtra("symbols_json") ?: "[]"
                    updateTrackedInstruments(symbolsJson)
                    fetchStockData()
                }
                Intent.ACTION_SCREEN_OFF,
                Intent.ACTION_SCREEN_ON,
                Intent.ACTION_USER_PRESENT -> {
                    applyMonochromeMode(!isDeviceInteractive())
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        trackedInstruments.clear()
        trackedInstruments.addAll(DEFAULT_TRACKED)

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Loading stock data..."))
        registerReceivers()
        setupOverlay()
        applyMonochromeMode(!isDeviceInteractive())
        handler.post(refreshRunnable)
    }

    private fun registerReceivers() {
        val filter = IntentFilter().apply {
            addAction(ACTION_SET_TRACKED_SYMBOLS)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        registerReceiver(serviceReceiver, filter)
    }

    private fun setupOverlay() {
        if (!android.provider.Settings.canDrawOverlays(this)) return

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        overlayView = LayoutInflater.from(this).inflate(R.layout.lock_screen_overlay, null)
        overlayRoot = overlayView!!.findViewById(R.id.overlay_root)
        rowsContainer = overlayView!!.findViewById(R.id.rows_container)
        lastUpdatedText = overlayView!!.findViewById(R.id.last_updated)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = 160 // offset from bottom
        }

        windowManager!!.addView(overlayView, params)
    }

    private fun updateTrackedInstruments(symbolsJson: String) {
        try {
            val arr = JSONArray(symbolsJson)
            val parsed = mutableListOf<TrackedInstrument>()

            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                val symbol = item.optString("symbol", "").trim()
                if (symbol.isBlank()) continue
                val name = item.optString("name", symbol).trim().ifBlank { symbol }
                val type = item.optString("type", "stock").trim().ifBlank { "stock" }
                parsed.add(TrackedInstrument(name, symbol, type))
            }

            if (parsed.isNotEmpty()) {
                trackedInstruments.clear()
                trackedInstruments.addAll(parsed.distinctBy { it.symbol })
            }
        } catch (_: Exception) {
            // Keep previous tracked list if parsing fails
        }
    }

    private fun fetchStockData() {
        val toTrack = trackedInstruments.toList()
        if (toTrack.isEmpty()) return

        Thread {
            val quotes = mutableListOf<QuoteData>()

            toTrack.forEach { instrument ->
                val quote = fetchQuoteFor(instrument)
                if (quote != null) quotes.add(quote)
            }

            if (quotes.isNotEmpty()) {
                handler.post {
                    updateUI(quotes)
                    updateNotification(quotes)
                }
            }
        }.start()
    }

    private fun fetchQuoteFor(instrument: TrackedInstrument): QuoteData? {
        return try {
            val encodedSymbol = URLEncoder.encode(instrument.symbol, "UTF-8")
            val url = "https://query1.finance.yahoo.com/v8/finance/chart/$encodedSymbol?interval=1m&range=1d"
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0")
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body?.string() ?: return null
                val meta = JSONObject(body)
                    .optJSONObject("chart")
                    ?.optJSONArray("result")
                    ?.optJSONObject(0)
                    ?.optJSONObject("meta")
                    ?: return null

                val price = meta.optDouble("regularMarketPrice", Double.NaN)
                if (price.isNaN()) return null

                val prevClose = meta.optDouble("previousClose", meta.optDouble("chartPreviousClose", price))
                val changePct = if (prevClose == 0.0) 0.0 else ((price - prevClose) / prevClose) * 100

                QuoteData(
                    name = instrument.name,
                    symbol = instrument.symbol,
                    type = instrument.type,
                    price = price,
                    changePercent = changePct
                )
            }
        } catch (_: IOException) {
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun updateUI(quotes: List<QuoteData>) {
        if (overlayView == null) return

        val fmt = NumberFormat.getNumberInstance(Locale("en", "IN")).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }

        rowsContainer.removeAllViews()

        quotes.forEachIndexed { idx, quote ->
            rowsContainer.addView(buildQuoteRow(quote, fmt, idx))
        }

        val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        lastUpdatedText.text = "Updated $time"
    }

    private fun buildQuoteRow(quote: QuoteData, fmt: NumberFormat, index: Int): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(22, 14, 22, 14)
            if (index > 0) {
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                lp.topMargin = 8
                layoutParams = lp
            }
            background = GradientDrawable().apply {
                cornerRadius = 18f
                setColor(Color.parseColor(if (monochromeMode) "#22111111" else "#22FFFFFF"))
                setStroke(1, Color.parseColor("#2AFFFFFF"))
            }
        }

        val left = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val nameText = TextView(this).apply {
            text = quote.name
            textSize = 10f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor(if (monochromeMode) "#B5B5B5" else "#8A9BB5"))
            letterSpacing = 0.08f
        }

        val symbolText = TextView(this).apply {
            text = quote.symbol
            textSize = 9f
            setTextColor(Color.parseColor(if (monochromeMode) "#8A8A8A" else "#5E6C84"))
        }

        val right = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.END
        }

        val priceText = TextView(this).apply {
            text = if (quote.type == "stock") "₹${fmt.format(quote.price)}" else fmt.format(quote.price)
            textSize = 19f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }

        val directionArrow = if (quote.changePercent >= 0) "↗" else "↘"
        val changeColor = when {
            monochromeMode -> Color.parseColor("#E0E0E0")
            quote.changePercent >= 0 -> Color.parseColor("#00C896")
            else -> Color.parseColor("#FF4D6A")
        }

        val changeText = TextView(this).apply {
            text = "$directionArrow ${String.format("%.2f", kotlin.math.abs(quote.changePercent))}%"
            textSize = 12f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(changeColor)
        }

        left.addView(nameText)
        left.addView(symbolText)
        right.addView(priceText)
        right.addView(changeText)

        row.addView(left)
        row.addView(right)

        return row
    }

    private fun updateNotification(quotes: List<QuoteData>) {
        val msg = quotes.joinToString(" | ") {
            val arrow = if (it.changePercent >= 0) "↗" else "↘"
            "${it.name}: ${String.format("%.2f", it.price)} ($arrow ${String.format("%.2f", kotlin.math.abs(it.changePercent))}%)"
        }
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(msg))
    }

    private fun applyMonochromeMode(enable: Boolean) {
        monochromeMode = enable
        if (!::overlayRoot.isInitialized) return
        overlayRoot.setBackgroundColor(
            Color.parseColor(if (enable) "#EE000000" else "#CC0A0F1A")
        )
        lastUpdatedText.setTextColor(Color.parseColor(if (enable) "#8A8A8A" else "#4A5568"))
    }

    private fun isDeviceInteractive(): Boolean {
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        return powerManager.isInteractive
    }

    private fun buildNotification(content: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StockLock")
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "StockLock Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Live stock prices on lock screen" }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(refreshRunnable)
        try {
            unregisterReceiver(serviceReceiver)
        } catch (_: Exception) {}
        overlayView?.let { windowManager?.removeView(it) }
    }

    override fun onBind(intent: Intent?) = null
}
