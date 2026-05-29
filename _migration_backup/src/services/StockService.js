// src/services/StockService.js
// Fetches live data from Yahoo Finance (no API key needed)

export const AVAILABLE_INDICES = [
  { id: 'NIFTY50', name: 'NIFTY 50', symbol: '^NSEI', type: 'index' },
  { id: 'NSEBANK', name: 'NSE BANK', symbol: '^NSEBANK', type: 'index' },
  { id: 'SENSEX', name: 'SENSEX (BSE)', symbol: '^BSESN', type: 'index' },
];

export const STOCK_CATALOG = [
  { name: 'ADANIGREEN', symbol: 'ADANIGREEN.NS', type: 'stock' },
  { name: 'RELIANCE', symbol: 'RELIANCE.NS', type: 'stock' },
  { name: 'TCS', symbol: 'TCS.NS', type: 'stock' },
  { name: 'INFY', symbol: 'INFY.NS', type: 'stock' },
  { name: 'HDFCBANK', symbol: 'HDFCBANK.NS', type: 'stock' },
  { name: 'ICICIBANK', symbol: 'ICICIBANK.NS', type: 'stock' },
  { name: 'SBIN', symbol: 'SBIN.NS', type: 'stock' },
  { name: 'ITC', symbol: 'ITC.NS', type: 'stock' },
  { name: 'LT', symbol: 'LT.NS', type: 'stock' },
  { name: 'AXISBANK', symbol: 'AXISBANK.NS', type: 'stock' },
  { name: 'KOTAKBANK', symbol: 'KOTAKBANK.NS', type: 'stock' },
  { name: 'BHARTIARTL', symbol: 'BHARTIARTL.NS', type: 'stock' },
  { name: 'HINDUNILVR', symbol: 'HINDUNILVR.NS', type: 'stock' },
  { name: 'BAJFINANCE', symbol: 'BAJFINANCE.NS', type: 'stock' },
  { name: 'MARUTI', symbol: 'MARUTI.NS', type: 'stock' },
  { name: 'NTPC', symbol: 'NTPC.NS', type: 'stock' },
  { name: 'POWERGRID', symbol: 'POWERGRID.NS', type: 'stock' },
  { name: 'SUNPHARMA', symbol: 'SUNPHARMA.NS', type: 'stock' },
  { name: 'WIPRO', symbol: 'WIPRO.NS', type: 'stock' },
  { name: 'TITAN', symbol: 'TITAN.NS', type: 'stock' },
];

export const DEFAULT_SELECTION = {
  indices: [AVAILABLE_INDICES[0]],
  stocks: [],
};

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const normalizeInstrumentName = (instrument, meta) => {
  if (instrument?.name) return instrument.name;
  return meta?.shortName || meta?.symbol || instrument?.symbol || 'UNKNOWN';
};

export const fetchQuote = async (instrument) => {
  const symbol = instrument?.symbol || '';

  try {
    const url = `${BASE_URL}/${symbol}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No data');

    const prevClose = meta.previousClose || meta.chartPreviousClose;
    if (!prevClose) throw new Error('No previous close');

    return {
      name: normalizeInstrumentName(instrument, meta),
      symbol: meta.symbol || symbol,
      type: instrument.type || 'stock',
      price: meta.regularMarketPrice,
      previousClose: prevClose,
      change: meta.regularMarketPrice - prevClose,
      changePercent:
        ((meta.regularMarketPrice - prevClose) / prevClose) * 100,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      marketState: meta.marketState, // REGULAR | PRE | POST | CLOSED
      currency: meta.currency,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err.message);
    return null;
  }
};

export const fetchTrackedQuotes = async (instruments) => {
  if (!Array.isArray(instruments) || instruments.length === 0) return [];

  const results = await Promise.all(
    instruments.map(async (instrument) => {
      const data = await fetchQuote(instrument);
      return data;
    })
  );

  return results.filter(Boolean);
};

export const searchStocks = (query) => {
  const q = query.trim().toUpperCase();
  if (!q) return STOCK_CATALOG.slice(0, 8);

  return STOCK_CATALOG.filter((item) =>
    item.name.includes(q) || item.symbol.includes(q)
  ).slice(0, 12);
};
