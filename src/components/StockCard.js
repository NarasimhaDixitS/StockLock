// src/components/StockCard.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

const formatPrice = (price, currency) => {
  if (!price) return '--';
  if (currency === 'INR') {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
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
      // Flash animation on price update
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      prevPrice.current = stock.price;
    }
  }, [stock.price]);

  return (
    <View style={[styles.card, isIndex && styles.indexCard]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.symbolText}>{stock.name}</Text>
          {stock.marketState && (
            <View style={[styles.marketBadge, stock.marketState === 'REGULAR' ? styles.marketOpen : styles.marketClosed]}>
              <Text style={styles.marketBadgeText}>
                {stock.marketState === 'REGULAR' ? 'LIVE' : stock.marketState}
              </Text>
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

      {/* Stats Row */}
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

      {/* Progress bar: price within day range */}
      {stock.high && stock.low && (
        <View style={styles.rangeBar}>
          <View
            style={[
              styles.rangeFill,
              {
                width: `${Math.min(100, Math.max(0, ((stock.price - stock.low) / (stock.high - stock.low)) * 100))}%`,
                backgroundColor: isPositive ? '#00C896' : '#FF4D6A',
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151B26',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2738',
  },
  indexCard: {
    borderColor: '#2A3550',
    backgroundColor: '#111827',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8EDF5',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  marketBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  marketOpen: { backgroundColor: 'rgba(0,200,150,0.15)' },
  marketClosed: { backgroundColor: 'rgba(255,77,106,0.15)' },
  marketBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
  },
  priceBlock: { alignItems: 'flex-end' },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  changePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  positiveBackground: { backgroundColor: 'rgba(0,200,150,0.15)' },
  negativeBackground: { backgroundColor: 'rgba(255,77,106,0.15)' },
  changeText: { fontSize: 13, fontWeight: '700' },
  positiveText: { color: '#00C896' },
  negativeText: { color: '#FF4D6A' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#4A5568', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 13, color: '#A0AEC0', fontWeight: '600' },
  statDivider: { width: 1, height: 24, backgroundColor: '#1E2738' },
  rangeBar: {
    height: 3,
    backgroundColor: '#1E2738',
    borderRadius: 2,
    overflow: 'hidden',
  },
  rangeFill: { height: '100%', borderRadius: 2 },
});
