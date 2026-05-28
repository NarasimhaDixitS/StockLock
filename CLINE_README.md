# StockLock — Cline Build & Deploy Guide

> **Read this fully before starting.** This README is written for Cline (AI coding assistant). Follow every step in order. Do not skip steps or assume defaults.

---

## What You Are Building

A React Native Android app called **StockLock** that:
- Shows a live **Nifty 50** index price and **ADANIGREEN.NS** stock price
- Displays them as an **overlay on the Android lock screen**, updating every 60 seconds
- Uses **Yahoo Finance** (free, no API key needed)
- Uses a **native Kotlin foreground service** for the lock screen overlay
- Auto-starts after device reboot

---

## Prerequisites — Check These First

Before writing any code, verify the following are available in the environment:

```bash
node --version          # Must be v18+
npm --version           # Must be v9+
git --version           # Any version
```

If any are missing, stop and inform the user.

---

## Step 1 — Scaffold the React Native Project

```bash
npx react-native@0.73.6 init StockLock --version 0.73.6
cd StockLock
```

> If prompted to install `react-native`, confirm yes.

---

## Step 2 — Install JS Dependencies

```bash
npm install \
  react-native-safe-area-context@4.8.2 \
  react-native-screens@3.29.0 \
  react-native-linear-gradient@2.8.3 \
  react-native-reanimated@3.6.2 \
  @react-native-async-storage/async-storage@1.21.0 \
  axios@1.6.7
```

---

## Step 3 — Create the File Structure

Create the following directories:

```
StockLock/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── screens/
│   └── services/
└── android/app/src/main/
    ├── java/com/stocklock/
    └── res/layout/
```

```bash
mkdir -p src/components src/hooks src/screens src/services
mkdir -p android/app/src/main/java/com/stocklock
mkdir -p android/app/src/main/res/layout
```

---

## Step 4 — Create All Source Files

Create each file below exactly as specified. Do not modify content unless instructed.

---

### 4.1 — `src/services/StockService.js`

Fetches Nifty 50 (`^NSEI`) and ADANIGREEN (`ADANIGREEN.NS`) from Yahoo Finance.

```javascript
const SYMBOLS = {
  NIFTY: '^NSEI',
  ADANIGREEN: 'ADANIGREEN.NS',
};

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const fetchQuote = async (symbol) => {
  try {
    const url = `${BASE_URL}/${symbol}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No data');
    const prevClose = meta.previousClose || meta.chartPreviousClose;
    return {
      symbol,
      price: meta.regularMarketPrice,
      previousClose: prevClose,
      change: meta.regularMarketPrice - prevClose,
      changePercent: ((meta.regularMarketPrice - prevClose) / prevClose) * 100,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      marketState: meta.marketState,
      currency: meta.currency,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err.message);
    return null;
  }
};

export const fetchAllStocks = async () => {
  const results = await Promise.all(
    Object.entries(SYMBOLS).map(async ([name, symbol]) => {
      const data = await fetchQuote(symbol);
      return { name, ...data };
    })
  );
  return results.filter(Boolean);
};

export const TRACKED_SYMBOLS = SYMBOLS;
```

---

### 4.2 — `src/hooks/useStockData.js`

Auto-refreshing hook. Pauses polling when app is backgrounded, resumes on foreground.

```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchAllStocks } from '../services/StockService';

const REFRESH_INTERVAL_MS = 60000;

export const useStockData = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAllStocks();
      if (data.length > 0) {
        setStocks(data);
        setLastUpdated(new Date());
      }
    } catch (e) {
      setError('Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    refresh();
    startPolling();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refresh();
        startPolling();
      } else if (nextState.match(/inactive|background/)) {
        stopPolling();
      }
      appStateRef.current = nextState;
    });
    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [refresh, startPolling, stopPolling]);

  return { stocks, loading, error, lastUpdated, refresh };
};
```

---

### 4.3 — `src/components/StockCard.js`

Price card with day-range bar and flash animation on price update.

```javascript
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const formatPrice = (price, currency) => {
  if (!price) return '--';
  if (currency === 'INR') return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatVolume = (vol) => {
  if (!vol) return '--';
  if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)}Cr`;
  if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)}L`;
  return vol.toLocaleString('en-IN');
};

export const StockCard = ({ stock, isIndex = false }) => {
  const isPositive = stock.change >= 0;
  const flashAnim = useRef(new Animated.Value(1)).current;
  const prevPrice = useRef(stock.price);

  useEffect(() => {
    if (prevPrice.current !== stock.price) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      prevPrice.current = stock.price;
    }
  }, [stock.price]);

  return (
    <View style={[styles.card, isIndex && styles.indexCard]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.symbolText}>{stock.name}</Text>
          {stock.marketState && (
            <View style={[styles.marketBadge, stock.marketState === 'REGULAR' ? styles.marketOpen : styles.marketClosed]}>
              <Text style={styles.marketBadgeText}>{stock.marketState === 'REGULAR' ? 'LIVE' : stock.marketState}</Text>
            </View>
          )}
        </View>
        <View style={styles.priceBlock}>
          <Animated.Text style={[styles.priceText, { opacity: flashAnim }]}>
            {formatPrice(stock.price, stock.currency)}
          </Animated.Text>
          <View style={[styles.changePill, isPositive ? styles.positiveBackground : styles.negativeBackground]}>
            <Text style={[styles.changeText, isPositive ? styles.positiveText : styles.negativeText]}>
              {isPositive ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>CHANGE</Text>
          <Text style={[styles.statValue, isPositive ? styles.positiveText : styles.negativeText]}>
            {isPositive ? '+' : ''}{stock.change?.toFixed(2)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>HIGH</Text>
          <Text style={styles.statValue}>{formatPrice(stock.high, stock.currency)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>LOW</Text>
          <Text style={styles.statValue}>{formatPrice(stock.low, stock.currency)}</Text>
        </View>
        {!isIndex && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>VOL</Text>
              <Text style={styles.statValue}>{formatVolume(stock.volume)}</Text>
            </View>
          </>
        )}
      </View>
      {stock.high && stock.low && (
        <View style={styles.rangeBar}>
          <View style={[styles.rangeFill, {
            width: `${Math.min(100, Math.max(0, ((stock.price - stock.low) / (stock.high - stock.low)) * 100))}%`,
            backgroundColor: isPositive ? '#00C896' : '#FF4D6A',
          }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#151B26', borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#1E2738' },
  indexCard: { borderColor: '#2A3550', backgroundColor: '#111827' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  symbolText: { fontSize: 18, fontWeight: '700', color: '#E8EDF5', letterSpacing: 0.5, marginBottom: 6 },
  marketBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  marketOpen: { backgroundColor: 'rgba(0,200,150,0.15)' },
  marketClosed: { backgroundColor: 'rgba(255,77,106,0.15)' },
  marketBadgeText: { fontSize: 9, fontWeight: '700', color: '#888', letterSpacing: 1 },
  priceBlock: { alignItems: 'flex-end' },
  priceText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  changePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  positiveBackground: { backgroundColor: 'rgba(0,200,150,0.15)' },
  negativeBackground: { backgroundColor: 'rgba(255,77,106,0.15)' },
  changeText: { fontSize: 13, fontWeight: '700' },
  positiveText: { color: '#00C896' },
  negativeText: { color: '#FF4D6A' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#4A5568', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 13, color: '#A0AEC0', fontWeight: '600' },
  statDivider: { width: 1, height: 24, backgroundColor: '#1E2738' },
  rangeBar: { height: 3, backgroundColor: '#1E2738', borderRadius: 2, overflow: 'hidden' },
  rangeFill: { height: '100%', borderRadius: 2 },
});
```

---

### 4.4 — `src/screens/HomeScreen.js`

Main app screen with pull-to-refresh.

```javascript
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl } from 'react-native';
import { useStockData } from '../hooks/useStockData';
import { StockCard } from '../components/StockCard';

const formatTime = (date) => {
  if (!date) return '--';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const HomeScreen = () => {
  const { stocks, loading, error, lastUpdated, refresh } = useStockData();
  const [refreshing, setRefreshing] = React.useState(false);
  const nifty = stocks.find((s) => s.name === 'NIFTY');
  const others = stocks.filter((s) => s.name !== 'NIFTY');

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1A" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>StockLock</Text>
          <Text style={styles.headerSub}>{lastUpdated ? `Updated ${formatTime(lastUpdated)}` : 'Fetching live data...'}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
          <Text style={styles.refreshIcon}>⟳</Text>
        </TouchableOpacity>
      </View>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C896" />
          <Text style={styles.loadingText}>Fetching market data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C896" />}>
          {nifty && (
            <View>
              <Text style={styles.sectionLabel}>INDEX</Text>
              <StockCard stock={nifty} isIndex />
            </View>
          )}
          {others.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>STOCKS</Text>
              {others.map((stock) => <StockCard key={stock.name} stock={stock} />)}
            </View>
          )}
          <View style={styles.lockBanner}>
            <Text style={styles.lockIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Lock Screen Active</Text>
              <Text style={styles.lockSub}>Nifty & ADANIGREEN are displaying on your lock screen, updating every minute.</Text>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#151B26' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#4A5568', marginTop: 2 },
  refreshBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#151B26', alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { fontSize: 22, color: '#00C896' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#4A5568', fontSize: 14 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorIcon: { fontSize: 40 },
  errorText: { color: '#FF4D6A', fontSize: 14 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#151B26', borderRadius: 12 },
  retryText: { color: '#00C896', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#4A5568', letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  lockBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151B26', borderRadius: 16, padding: 16, gap: 12, marginTop: 10, borderWidth: 1, borderColor: '#1E2738' },
  lockIcon: { fontSize: 28 },
  lockTitle: { color: '#E8EDF5', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  lockSub: { color: '#4A5568', fontSize: 12, lineHeight: 18 },
});
```

---

### 4.5 — `src/screens/PermissionScreen.js`

Guides user to grant "Display over other apps" permission.

```javascript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';

export const PermissionScreen = ({ onGranted }) => {
  const requestOverlayPermission = () => {
    if (Platform.OS === 'android') Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>One Permission Needed</Text>
      <Text style={styles.description}>
        To show Nifty & ADANIGREEN on your lock screen, StockLock needs the{' '}
        <Text style={styles.bold}>"Display over other apps"</Text> permission.
      </Text>
      <View style={styles.steps}>
        {['Tap "Open Settings" below', 'Find StockLock in the list', 'Toggle "Allow display over other apps"', 'Come back and tap Continue'].map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={requestOverlayPermission}>
        <Text style={styles.primaryBtnText}>Open Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onGranted}>
        <Text style={styles.secondaryBtnText}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A', padding: 32, justifyContent: 'center' },
  icon: { fontSize: 64, textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 15, color: '#7A8BA0', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  bold: { color: '#E8EDF5', fontWeight: '700' },
  steps: { gap: 16, marginBottom: 48 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#151B26', borderWidth: 1, borderColor: '#00C896', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#00C896', fontWeight: '800', fontSize: 13 },
  stepText: { color: '#A0AEC0', fontSize: 14, flex: 1 },
  primaryBtn: { backgroundColor: '#00C896', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#0A0F1A', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#4A5568', fontSize: 15 },
});
```

---

### 4.6 — `App.js` (replace the default one)

```javascript
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { NativeModules, Platform } from 'react-native';

const { LockScreenModule } = NativeModules;

const App = () => {
  useEffect(() => {
    if (Platform.OS === 'android' && LockScreenModule) {
      LockScreenModule.startService();
    }
  }, []);

  return (
    <SafeAreaProvider>
      <HomeScreen />
    </SafeAreaProvider>
  );
};

export default App;
```

---

## Step 5 — Create Native Android Files (Kotlin)

---

### 5.1 — `android/app/src/main/java/com/stocklock/LockScreenModule.kt`

```kotlin
package com.stocklock

import android.content.Intent
import com.facebook.react.bridge.*

class LockScreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LockScreenModule"

    @ReactMethod
    fun startService() {
        val intent = Intent(reactApplicationContext, LockScreenService::class.java)
        reactApplicationContext.startForegroundService(intent)
    }

    @ReactMethod
    fun stopService() {
        val intent = Intent(reactApplicationContext, LockScreenService::class.java)
        reactApplicationContext.stopService(intent)
    }
}
```

---

### 5.2 — `android/app/src/main/java/com/stocklock/LockScreenPackage.kt`

```kotlin
package com.stocklock

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LockScreenPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(LockScreenModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

---

### 5.3 — `android/app/src/main/java/com/stocklock/LockScreenService.kt`

This is the foreground service that draws the overlay on the lock screen and fetches stock prices independently via OkHttp every 60 seconds.

```kotlin
package com.stocklock

import android.app.*
import android.content.*
import android.graphics.*
import android.os.*
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

class LockScreenService : Service() {

    companion object {
        const val CHANNEL_ID = "StockLockChannel"
        const val NOTIFICATION_ID = 1001
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private lateinit var niftyPriceText: TextView
    private lateinit var niftyChangeText: TextView
    private lateinit var adaniPriceText: TextView
    private lateinit var adaniChangeText: TextView
    private lateinit var lastUpdatedText: TextView

    private val handler = Handler(Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            fetchStockData()
            handler.postDelayed(this, 60_000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Loading stock data..."))
        setupOverlay()
        handler.post(refreshRunnable)
    }

    private fun setupOverlay() {
        if (!android.provider.Settings.canDrawOverlays(this)) return
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayView = LayoutInflater.from(this).inflate(R.layout.lock_screen_overlay, null)
        niftyPriceText = overlayView!!.findViewById(R.id.nifty_price)
        niftyChangeText = overlayView!!.findViewById(R.id.nifty_change)
        adaniPriceText = overlayView!!.findViewById(R.id.adani_price)
        adaniChangeText = overlayView!!.findViewById(R.id.adani_change)
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
            y = 160
        }
        windowManager!!.addView(overlayView, params)
    }

    private fun fetchStockData() {
        val client = OkHttpClient()
        val symbols = mapOf("NIFTY" to "%5ENSEI", "ADANI" to "ADANIGREEN.NS")
        val results = mutableMapOf<String, Pair<Double, Double>>()

        symbols.forEach { (name, symbol) ->
            val url = "https://query1.finance.yahoo.com/v8/finance/chart/$symbol?interval=1m&range=1d"
            val request = Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build()
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {}
                override fun onResponse(call: Call, response: Response) {
                    response.body?.string()?.let { body ->
                        try {
                            val meta = JSONObject(body).getJSONObject("chart")
                                .getJSONArray("result").getJSONObject(0).getJSONObject("meta")
                            val price = meta.getDouble("regularMarketPrice")
                            val prev = meta.optDouble("previousClose", meta.optDouble("chartPreviousClose", price))
                            val changePct = ((price - prev) / prev) * 100
                            results[name] = Pair(price, changePct)
                            if (results.size == symbols.size) {
                                val n = results["NIFTY"] ?: Pair(0.0, 0.0)
                                val a = results["ADANI"] ?: Pair(0.0, 0.0)
                                handler.post {
                                    updateUI(n.first, n.second, a.first, a.second)
                                    updateNotification(n.first, n.second, a.first, a.second)
                                }
                            }
                        } catch (_: Exception) {}
                    }
                }
            })
        }
    }

    private fun updateUI(niftyPrice: Double, niftyPct: Double, adaniPrice: Double, adaniPct: Double) {
        if (overlayView == null) return
        val fmt = java.text.NumberFormat.getNumberInstance(java.util.Locale("en", "IN"))
        fmt.minimumFractionDigits = 2; fmt.maximumFractionDigits = 2
        niftyPriceText.text = fmt.format(niftyPrice)
        niftyChangeText.text = "${if (niftyPct >= 0) "▲" else "▼"} ${String.format("%.2f", Math.abs(niftyPct))}%"
        niftyChangeText.setTextColor(if (niftyPct >= 0) Color.parseColor("#00C896") else Color.parseColor("#FF4D6A"))
        adaniPriceText.text = "₹${fmt.format(adaniPrice)}"
        adaniChangeText.text = "${if (adaniPct >= 0) "▲" else "▼"} ${String.format("%.2f", Math.abs(adaniPct))}%"
        adaniChangeText.setTextColor(if (adaniPct >= 0) Color.parseColor("#00C896") else Color.parseColor("#FF4D6A"))
        val time = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
        lastUpdatedText.text = "Updated $time"
    }

    private fun updateNotification(niftyPrice: Double, niftyPct: Double, adaniPrice: Double, adaniPct: Double) {
        val msg = "Nifty: ${String.format("%.0f", niftyPrice)} (${String.format("%+.2f", niftyPct)}%) | ADANIGREEN: ₹${String.format("%.2f", adaniPrice)} (${String.format("%+.2f", adaniPct)}%)"
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(msg))
    }

    private fun buildNotification(content: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StockLock").setContentText(content)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW).setOngoing(true).build()

    private fun createNotificationChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "StockLock Service", NotificationManager.IMPORTANCE_LOW)
            .apply { description = "Live stock prices on lock screen" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(refreshRunnable)
        overlayView?.let { windowManager?.removeView(it) }
    }

    override fun onBind(intent: Intent?) = null
}
```

---

### 5.4 — `android/app/src/main/java/com/stocklock/BootReceiver.kt`

```kotlin
package com.stocklock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            context.startForegroundService(Intent(context, LockScreenService::class.java))
        }
    }
}
```

---

### 5.5 — `android/app/src/main/res/layout/lock_screen_overlay.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="16dp"
    android:background="#CC0A0F1A"
    android:gravity="center">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:background="#22FFFFFF"
            android:padding="12dp"
            android:layout_marginEnd="6dp"
            android:gravity="center">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content"
                android:text="NIFTY 50" android:textColor="#7A8BA0" android:textSize="9sp"
                android:letterSpacing="0.15" android:textStyle="bold"/>
            <TextView android:id="@+id/nifty_price" android:layout_width="wrap_content"
                android:layout_height="wrap_content" android:text="--" android:textColor="#FFFFFF"
                android:textSize="20sp" android:textStyle="bold" android:layout_marginTop="2dp"/>
            <TextView android:id="@+id/nifty_change" android:layout_width="wrap_content"
                android:layout_height="wrap_content" android:text="--" android:textColor="#00C896"
                android:textSize="12sp" android:textStyle="bold" android:layout_marginTop="2dp"/>
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:background="#22FFFFFF"
            android:padding="12dp"
            android:layout_marginStart="6dp"
            android:gravity="center">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content"
                android:text="ADANIGREEN" android:textColor="#7A8BA0" android:textSize="9sp"
                android:letterSpacing="0.15" android:textStyle="bold"/>
            <TextView android:id="@+id/adani_price" android:layout_width="wrap_content"
                android:layout_height="wrap_content" android:text="--" android:textColor="#FFFFFF"
                android:textSize="20sp" android:textStyle="bold" android:layout_marginTop="2dp"/>
            <TextView android:id="@+id/adani_change" android:layout_width="wrap_content"
                android:layout_height="wrap_content" android:text="--" android:textColor="#00C896"
                android:textSize="12sp" android:textStyle="bold" android:layout_marginTop="2dp"/>
        </LinearLayout>
    </LinearLayout>

    <TextView android:id="@+id/last_updated" android:layout_width="wrap_content"
        android:layout_height="wrap_content" android:text="Updating..." android:textColor="#4A5568"
        android:textSize="10sp" android:layout_marginTop="8dp"/>
</LinearLayout>
```

---

### 5.6 — `android/app/src/main/AndroidManifest.xml` (replace existing)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.stocklock">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:name=".MainApplication"
        android:label="StockLock"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:label="StockLock"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true"
            android:showOnLockScreen="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".LockScreenService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="dataSync" />

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

---

## Step 6 — Register the Native Module

Open `android/app/src/main/java/com/stocklock/MainApplication.kt`.

Find the `getPackages()` function and add `LockScreenPackage()`:

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(LockScreenPackage())   // ← ADD THIS LINE
    }
```

> **Important:** Do not remove any existing packages. Only add the new line.

---

## Step 7 — Add OkHttp Dependency

Open `android/app/build.gradle` and inside the `dependencies {}` block add:

```gradle
implementation("com.squareup.okhttp3:okhttp:4.12.0")
```

---

## Step 8 — Build and Run

### Option A — USB (phone connected to computer)

```bash
# Enable USB Debugging on phone first, then:
npx react-native run-android
```

### Option B — EAS Cloud Build (no Android Studio needed)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

This uploads your code to Expo's build servers and returns a download link for the APK in ~10 minutes.

For EAS, create `eas.json` in the project root:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

---

## Step 9 — On the Phone After Install

1. Open the **StockLock** app
2. Tap **"Open Settings"**
3. Find **StockLock** → enable **"Allow display over other apps"**
4. Return to the app → tap **"Continue"**
5. Lock your phone — the Nifty + ADANIGREEN widget appears at the bottom of the lock screen

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with `JAVA_HOME not set` | Install JDK 17, set `JAVA_HOME` env variable |
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=/path/to/Android/Sdk` |
| Overlay not appearing | Check "Display over other apps" permission is enabled |
| Prices show `--` | Markets may be closed; prices update when NSE is open (9:15am–3:30pm IST) |
| Yahoo Finance returns 429 | Rate limited; 60s interval should prevent this |
| App crashes on start | Run `npx react-native log-android` to see error logs |

---

## Adding More Stocks Later

In `src/services/StockService.js`, add to `SYMBOLS`:

```javascript
const SYMBOLS = {
  NIFTY: '^NSEI',
  ADANIGREEN: 'ADANIGREEN.NS',
  TCS: 'TCS.NS',
  RELIANCE: 'RELIANCE.NS',
};
```

In `LockScreenService.kt`, add the new symbol to the `symbols` map in `fetchStockData()` and add a new tile in `lock_screen_overlay.xml`.
