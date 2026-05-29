// src/screens/HomeScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  NativeModules,
  Platform,
} from 'react-native';
import { useStockData } from '../hooks/useStockData';
import { StockCard } from '../components/StockCard';
import {
  AVAILABLE_INDICES,
  DEFAULT_SELECTION,
  searchStocks,
} from '../services/StockService';
import {
  clearAllIndices,
  loadSelection,
  MAX_STOCK_SELECTION,
  normalizeSelection,
  saveSelection,
  selectAllIndices,
} from '../services/SelectionStorage';

const { LockScreenModule } = NativeModules;

const formatTime = (date) => {
  if (!date) return '--';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const HomeScreen = () => {
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [selectionReady, setSelectionReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stockQuery, setStockQuery] = useState('');

  const trackedInstruments = useMemo(
    () => [...selection.indices, ...selection.stocks],
    [selection]
  );

  const { stocks, loading, error, lastUpdated, refresh } = useStockData({
    trackedInstruments,
    enabled: selectionReady && trackedInstruments.length > 0,
  });

  const selectedStockSymbols = useMemo(
    () => new Set(selection.stocks.map((s) => s.symbol)),
    [selection.stocks]
  );

  const stockSuggestions = useMemo(
    () =>
      searchStocks(stockQuery).filter(
        (item) => !selectedStockSymbols.has(item.symbol)
      ),
    [stockQuery, selectedStockSymbols]
  );

  const indexStocks = stocks.filter((s) => s.type === 'index');
  const equityStocks = stocks.filter((s) => s.type !== 'index');

  useEffect(() => {
    let mounted = true;
    loadSelection().then((loaded) => {
      if (!mounted) return;
      setSelection(normalizeSelection(loaded));
      setSelectionReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectionReady) return;

    saveSelection(selection).catch(() => {});

    if (Platform.OS === 'android' && LockScreenModule?.setTrackedSymbols) {
      const payload = JSON.stringify(trackedInstruments);
      LockScreenModule.setTrackedSymbols(payload);
    }
  }, [selectionReady, selection, trackedInstruments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const toggleIndex = (indexItem) => {
    setSelection((prev) => {
      const exists = prev.indices.some((i) => i.symbol === indexItem.symbol);
      if (exists && prev.indices.length === 1) {
        Alert.alert('At least one index required', 'Keep at least one index selected.');
        return prev;
      }

      const indices = exists
        ? prev.indices.filter((i) => i.symbol !== indexItem.symbol)
        : [...prev.indices, indexItem];

      return normalizeSelection({ ...prev, indices });
    });
  };

  const addStock = (stockItem) => {
    setSelection((prev) => {
      if (prev.stocks.some((s) => s.symbol === stockItem.symbol)) return prev;
      if (prev.stocks.length >= MAX_STOCK_SELECTION) {
        Alert.alert('Limit reached', `You can select up to ${MAX_STOCK_SELECTION} stocks.`);
        return prev;
      }

      return normalizeSelection({ ...prev, stocks: [...prev.stocks, stockItem] });
    });
    setStockQuery('');
  };

  const removeStock = (symbol) => {
    setSelection((prev) =>
      normalizeSelection({
        ...prev,
        stocks: prev.stocks.filter((s) => s.symbol !== symbol),
      })
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1A" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>StockLock</Text>
          <Text style={styles.headerSub}>
            {lastUpdated ? `Updated ${formatTime(lastUpdated)}` : 'Fetching live data...'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
          <Text style={styles.refreshIcon}>⟳</Text>
        </TouchableOpacity>
      </View>

      {!selectionReady || (loading && !refreshing) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C896" />
          <Text style={styles.loadingText}>{selectionReady ? 'Fetching market data...' : 'Loading your selections...'}</Text>
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00C896"
            />
          }
        >
          <Text style={styles.sectionLabel}>INDICES</Text>
          <View style={styles.selectorRow}>
            {AVAILABLE_INDICES.map((item) => {
              const selected = selection.indices.some((i) => i.symbol === item.symbol);
              return (
                <TouchableOpacity
                  key={item.symbol}
                  style={[styles.selectorChip, selected && styles.selectorChipActive]}
                  onPress={() => toggleIndex(item)}
                >
                  <Text style={[styles.selectorChipText, selected && styles.selectorChipTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.selectorActions}>
            <TouchableOpacity
              style={styles.smallActionBtn}
              onPress={() => setSelection((prev) => normalizeSelection({ ...prev, indices: selectAllIndices() }))}
            >
              <Text style={styles.smallActionText}>Select all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallActionBtn}
              onPress={() => setSelection((prev) => normalizeSelection({ ...prev, indices: clearAllIndices() }))}
            >
              <Text style={styles.smallActionText}>Default only</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>ADD STOCKS (UP TO 3)</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Type stock name or symbol (e.g. RELIANCE)"
            placeholderTextColor="#4A5568"
            value={stockQuery}
            onChangeText={setStockQuery}
          />

          {stockQuery.trim().length > 0 && (
            <View style={styles.suggestionList}>
              {stockSuggestions.length === 0 ? (
                <Text style={styles.noSuggestion}>No matching stocks found</Text>
              ) : (
                stockSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.symbol}
                    style={styles.suggestionItem}
                    onPress={() => addStock(item)}
                  >
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionSymbol}>{item.symbol}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {selection.stocks.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>SELECTED STOCKS</Text>
              <View style={styles.selectorRow}>
                {selection.stocks.map((item) => (
                  <TouchableOpacity
                    key={item.symbol}
                    style={[styles.selectorChip, styles.selectorChipActive]}
                    onPress={() => removeStock(item.symbol)}
                  >
                    <Text style={[styles.selectorChipText, styles.selectorChipTextActive]}>
                      {item.name} ✕
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {indexStocks.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>MARKET INDICES</Text>
              {indexStocks.map((stock) => (
                <StockCard key={stock.name} stock={stock} />
              ))}
            </View>
          )}

          {equityStocks.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>STOCK DATA</Text>
              {equityStocks.map((stock) => (
                <StockCard key={stock.name} stock={stock} />
              ))}
            </View>
          )}

          {/* Lock screen info banner */}
          <View style={styles.lockBanner}>
            <Text style={styles.lockIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Lock Screen Active</Text>
              <Text style={styles.lockSub}>
                Selected indices/stocks are shown on your lock screen, with zigzag trend arrows and minute-wise refresh.
              </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#151B26',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 12, color: '#4A5568', marginTop: 2 },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#151B26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: { fontSize: 22, color: '#00C896' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#4A5568', fontSize: 14 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorIcon: { fontSize: 40 },
  errorText: { color: '#FF4D6A', fontSize: 14 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#151B26',
    borderRadius: 12,
  },
  retryText: { color: '#00C896', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4A5568',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorChip: {
    borderWidth: 1,
    borderColor: '#2A3550',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#151B26',
  },
  selectorChipActive: {
    borderColor: '#00C896',
    backgroundColor: 'rgba(0,200,150,0.15)',
  },
  selectorChipText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
  },
  selectorChipTextActive: {
    color: '#00E8AA',
  },
  selectorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  smallActionBtn: {
    backgroundColor: '#151B26',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#253146',
  },
  smallActionText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
  },
  searchInput: {
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253146',
    backgroundColor: '#151B26',
    color: '#E8EDF5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  suggestionList: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E2738',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2738',
  },
  suggestionName: {
    color: '#E8EDF5',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionSymbol: {
    color: '#7A8BA0',
    fontSize: 11,
    marginTop: 2,
  },
  noSuggestion: {
    color: '#7A8BA0',
    padding: 12,
    fontSize: 12,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151B26',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E2738',
  },
  lockIcon: { fontSize: 28 },
  lockTitle: { color: '#E8EDF5', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  lockSub: { color: '#4A5568', fontSize: 12, lineHeight: 18 },
});
