// App.js
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { NativeModules, Platform } from 'react-native';

const { LockScreenModule } = NativeModules;

const App = () => {
  useEffect(() => {
    if (Platform.OS === 'android' && LockScreenModule) {
      // Start the lock screen overlay service on mount
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
