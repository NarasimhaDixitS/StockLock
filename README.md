# StockLock 📈🔒

A React Native Android app that shows **Nifty 50** and **ADANIGREEN** live prices on your Android lock screen, updating every minute via Yahoo Finance (no API key needed).

---

## Features

- ✅ Live Nifty 50 index price + % change
- ✅ Live ADANIGREEN.NS price + % change
- ✅ Lock screen overlay (always visible, even on lock screen)
- ✅ Auto-refreshes every 60 seconds
- ✅ Persists across reboots (auto-starts on boot)
- ✅ Foreground notification with live prices
- ✅ Day high/low range bar in app
- ✅ Flash animation on price update

---

## Setup

### Prerequisites
- Node.js 18+
- React Native CLI (not Expo)
- Android Studio + Android SDK 33+
- Java 17

### 1. Install dependencies

```bash
npm install
cd android && ./gradlew clean && cd ..
```

### 2. Run on device/emulator

```bash
npx react-native run-android
```

### 3. Grant the Overlay Permission

When the app launches, it will prompt you to enable **"Display over other apps"** for StockLock. This is required for the lock screen widget to work.

- Go to **Settings → Apps → StockLock → Display over other apps → Allow**

### 4. Register the native module

In your `MainApplication.kt`, add `LockScreenPackage()` to the packages list:

```kotlin
override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
    add(LockScreenPackage())
}
```

---

## Architecture

```
StockLock/
├── App.js                          # Root — starts native service
├── src/
│   ├── services/StockService.js    # Yahoo Finance API fetcher
│   ├── hooks/useStockData.js       # Auto-refresh hook (60s)
│   ├── components/StockCard.js     # Price card UI
│   └── screens/
│       ├── HomeScreen.js           # Main app screen
│       └── PermissionScreen.js     # Overlay permission guide
└── android/app/src/main/
    ├── java/com/stocklock/
    │   ├── LockScreenModule.kt     # RN Bridge module
    │   ├── LockScreenPackage.kt    # Package registration
    │   ├── LockScreenService.kt    # Foreground service + overlay
    │   └── BootReceiver.kt         # Auto-start on reboot
    ├── res/layout/
    │   └── lock_screen_overlay.xml # Lock screen widget layout
    └── AndroidManifest.xml         # Permissions declaration
```

---

## Adding More Stocks

In `src/services/StockService.js`, add to the `SYMBOLS` object:

```js
const SYMBOLS = {
  NIFTY: '^NSEI',
  ADANIGREEN: 'ADANIGREEN.NS',
  TCS: 'TCS.NS',         // ← add any NSE stock like this
  RELIANCE: 'RELIANCE.NS',
};
```

In `LockScreenService.kt`, extend `fetchStockData()` to include the new symbols and update the overlay layout accordingly.

---

## Permissions Used

| Permission | Why |
|---|---|
| `INTERNET` | Fetch stock prices from Yahoo Finance |
| `SYSTEM_ALERT_WINDOW` | Draw the overlay on lock screen |
| `FOREGROUND_SERVICE` | Keep service alive in background |
| `RECEIVE_BOOT_COMPLETED` | Auto-start after device reboot |

---

## Known Limitations

- Yahoo Finance may rate-limit requests; a 60s interval avoids this
- Lock screen overlay requires Android 8.0+ (API 26+)
- iOS lock screen widgets are not supported in React Native without separate native code
- Markets closed = prices show last close value
