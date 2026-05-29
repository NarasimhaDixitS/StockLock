import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PermissionRow = ({ title, description, granted, ctaText, onPress }) => (
  <View style={styles.row}>
    <View style={styles.rowHeader}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={[styles.badge, granted ? styles.badgeOk : styles.badgeMissing]}>
        {granted ? 'Enabled' : 'Required'}
      </Text>
    </View>
    <Text style={styles.rowDescription}>{description}</Text>
    {!granted && (
      <TouchableOpacity style={styles.rowButton} onPress={onPress}>
        <Text style={styles.rowButtonText}>{ctaText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const PermissionScreen = ({ status, onOpenOverlay, onOpenNotifications, onOpenBattery, onRefresh, onContinue }) => {
  const allCriticalGranted = status.overlay && status.notifications;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.icon}>🔐</Text>
      <Text style={styles.title}>Enable Required Access</Text>
      <Text style={styles.description}>
        StockLock needs a few permissions on Samsung to show lock-screen cards reliably.
      </Text>

      <PermissionRow
        title="Appear on top"
        description="Required to draw cards on lock screen."
        granted={status.overlay}
        ctaText="Open Overlay Settings"
        onPress={onOpenOverlay}
      />

      <PermissionRow
        title="Notifications"
        description="Required for foreground service. If blocked, lock-screen service can be killed."
        granted={status.notifications}
        ctaText="Open Notification Settings"
        onPress={onOpenNotifications}
      />

      <PermissionRow
        title="Battery Unrestricted"
        description="Recommended on Samsung so service keeps running in background."
        granted={status.battery}
        ctaText="Open Battery Settings"
        onPress={onOpenBattery}
      />

      <TouchableOpacity style={styles.secondaryBtn} onPress={onRefresh}>
        <Text style={styles.secondaryBtnText}>Refresh permission status</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryBtn, !allCriticalGranted && styles.primaryBtnDisabled]}
        onPress={onContinue}
        disabled={!allCriticalGranted}
      >
        <Text style={styles.primaryBtnText}>
          {allCriticalGranted ? 'Continue to App' : 'Enable required permissions first'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  content: { padding: 24, paddingBottom: 40 },
  icon: { fontSize: 56, textAlign: 'center', marginTop: 18, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  description: { fontSize: 14, color: '#7A8BA0', textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 22 },
  row: {
    backgroundColor: '#121A28',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 14,
    marginBottom: 12,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { color: '#E8EDF5', fontWeight: '700', fontSize: 15, flex: 1 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badgeOk: { color: '#0B1A13', backgroundColor: '#64E7B0' },
  badgeMissing: { color: '#2B1700', backgroundColor: '#FFD08A' },
  rowDescription: { color: '#93A4BB', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 10 },
  rowButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#22304A',
  },
  rowButtonText: { color: '#C7D7F0', fontWeight: '700', fontSize: 12 },
  secondaryBtn: {
    marginTop: 8,
    marginBottom: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: { color: '#8FA4C8', fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#00C896',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#2A3A46' },
  primaryBtnText: { color: '#08110D', fontWeight: '800', fontSize: 15 },
});
