// src/services/SelectionStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AVAILABLE_INDICES,
  DEFAULT_SELECTION,
  STOCK_CATALOG,
} from './StockService';

const STORAGE_KEY = '@stocklock:selected_instruments:v1';
export const MAX_STOCK_SELECTION = 3;

const uniqueBySymbol = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.symbol || seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });
};

export const normalizeSelection = (selection) => {
  const indices = uniqueBySymbol(
    (selection?.indices || []).filter((item) => item?.type === 'index')
  );

  const stocks = uniqueBySymbol(
    (selection?.stocks || []).filter((item) => item?.type === 'stock')
  ).slice(0, MAX_STOCK_SELECTION);

  return {
    indices: indices.length > 0 ? indices : DEFAULT_SELECTION.indices,
    stocks,
  };
};

export const getDefaultSelection = () => ({
  indices: [...DEFAULT_SELECTION.indices],
  stocks: [...DEFAULT_SELECTION.stocks],
});

export const loadSelection = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSelection();
    return normalizeSelection(JSON.parse(raw));
  } catch {
    return getDefaultSelection();
  }
};

export const saveSelection = async (selection) => {
  const normalized = normalizeSelection(selection);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const selectAllIndices = () => [...AVAILABLE_INDICES];

export const clearAllIndices = () => [...DEFAULT_SELECTION.indices];

export const isCatalogStock = (symbol) =>
  STOCK_CATALOG.some((s) => s.symbol === symbol);
