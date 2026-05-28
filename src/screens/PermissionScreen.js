// src/screens/PermissionScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  NativeModules,
  Linking,
  Platform,
} from 'react-native';

export const PermissionScreen = ({ onGranted }) => {
  const requestOverlayPermission = () => {
    if (Platform.OS === 'android') {
      // Opens Android's "Display over other apps" settings page
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>One Permission Needed</Text>
      <Text style={styles.description}>
        To show Nifty & ADANIGREEN on your lock screen, StockLock needs the
        {' '}<Text style={styles.bold}>"Display over other apps"</Text>{' '}
        permission.
      </Text>

      <View style={styles.steps}>
        {['Tap "Open Settings" below', 'Find StockLock in the list', 'Toggle "Allow display over other apps"', 'Come back and tap Continue'].map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
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
  stepNum: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#151B26', borderWidth: 1, borderColor: '#00C896',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: '#00C896', fontWeight: '800', fontSize: 13 },
  stepText: { color: '#A0AEC0', fontSize: 14, flex: 1 },
  primaryBtn: {
    backgroundColor: '#00C896', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: '#0A0F1A', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#4A5568', fontSize: 15 },
});
