export type YahooPricePoint = {
  timestamp: string;
  price: number;
};

type YahooChartResponse = {
  chart?: {
    error?: { description?: string; code?: string } | null;
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    } | null>;
  };
};

function yahooSymbol(symbol: string, assetType: string) {
  if (assetType === "CRYPTO" && symbol === "BTC") return "BTC-USD";
  if (assetType === "CRYPTO" && symbol === "ETH") return "ETH-USD";
  return symbol;
}

export async function fetchYahooMonth(symbol: string, assetType: string) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ticker = yahooSymbol(symbol, assetType);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set("period1", Math.floor(start.getTime() / 1000).toString());
  url.searchParams.set("period2", Math.floor(end.getTime() / 1000).toString());
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 VybeVentureMockBank/1.0" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${response.status}.`);
  }

  const payload = await response.json() as YahooChartResponse;
  const chart = payload.chart;
  const result = chart?.result?.[0];
  if (chart?.error || !result) {
    throw new Error(chart?.error?.description ?? `Yahoo Finance has no price history for ${ticker}.`);
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const prices: YahooPricePoint[] = timestamps.flatMap((timestamp, index) => {
    const price = closes[index];
    if (typeof price !== "number" || !Number.isFinite(price)) return [];
    return [{ timestamp: new Date(timestamp * 1000).toISOString(), price }];
  });

  if (prices.length === 0) {
    throw new Error(`Yahoo Finance returned no daily closing prices for ${ticker}.`);
  }

  const firstPrice = prices[0].price;
  const latestPrice = result.meta?.regularMarketPrice ?? prices[prices.length - 1].price;

  return {
    symbol,
    yahooSymbol: result.meta?.symbol ?? ticker,
    name: result.meta?.longName ?? result.meta?.shortName ?? symbol,
    currency: result.meta?.currency ?? "USD",
    source: "Yahoo Finance",
    interval: "1d",
    start: start.toISOString(),
    end: end.toISOString(),
    latestPrice,
    changePercent: firstPrice === 0 ? 0 : ((latestPrice - firstPrice) / firstPrice) * 100,
    prices,
  };
}
