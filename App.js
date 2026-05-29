// App.js
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { PermissionScreen } from './src/screens/PermissionScreen';

const { LockScreenModule } = NativeModules;

const App = () => {
  const [permissionStatus, setPermissionStatus] = useState({
    overlay: Platform.OS !== 'android',
    notifications: Platform.OS !== 'android',
    battery: Platform.OS !== 'android',
  });
  const [ready, setReady] = useState(Platform.OS !== 'android');

  const requestNotificationPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    if (Platform.OS !== 'android' || !LockScreenModule) {
      setPermissionStatus({ overlay: true, notifications: true, battery: true });
      return;
    }

    const [overlay, notificationsEnabled, battery] = await Promise.all([
      LockScreenModule?.isOverlayPermissionGranted?.() ?? true,
      LockScreenModule?.areNotificationsEnabled?.() ?? true,
      LockScreenModule?.isIgnoringBatteryOptimizations?.() ?? true,
    ]);

    setPermissionStatus({
      overlay: !!overlay,
      notifications: !!notificationsEnabled,
      battery: !!battery,
    });
  }, []);

  const canContinue = permissionStatus.overlay && permissionStatus.notifications;

  const continueToApp = useCallback(async () => {
    if (Platform.OS === 'android' && LockScreenModule) {
      await LockScreenModule.startService();
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const init = async () => {
      await requestNotificationPermission();
      await refreshPermissionStatus();
    };

    init();
  }, [refreshPermissionStatus, requestNotificationPermission]);

  return (
    <SafeAreaProvider>
      {ready ? (
        <HomeScreen />
      ) : (
        <PermissionScreen
          status={permissionStatus}
          onOpenOverlay={() =>
            LockScreenModule?.openOverlaySettings?.() || Linking.openSettings()
          }
          onOpenNotifications={() =>
            LockScreenModule?.openNotificationSettings?.() || Linking.openSettings()
          }
          onOpenBattery={() =>
            LockScreenModule?.openBatteryOptimizationSettings?.() || Linking.openSettings()
          }
          onRefresh={refreshPermissionStatus}
          onContinue={canContinue ? continueToApp : refreshPermissionStatus}
        />
      )}
    </SafeAreaProvider>
  );
};

export default App;
