// src/hooks/useStockData.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchTrackedQuotes } from '../services/StockService';

const REFRESH_INTERVAL_MS = 60000; // 1 minute

export const useStockData = ({ trackedInstruments = [], enabled = true }) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    try {
      setError(null);
      const data = await fetchTrackedQuotes(trackedInstruments);
      if (data.length > 0) {
        setStocks(data);
        setLastUpdated(new Date());
      } else {
        setStocks([]);
      }
    } catch (e) {
      setError('Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, [enabled, trackedInstruments]);

  const startPolling = useCallback(() => {
    if (!enabled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
  }, [enabled, refresh]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      setLoading(false);
      setStocks([]);
      return;
    }

    setLoading(true);
    refresh();
    startPolling();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // App came to foreground — refresh immediately
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
  }, [enabled, refresh, startPolling, stopPolling]);

  return { stocks, loading, error, lastUpdated, refresh };
};
