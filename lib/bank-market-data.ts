import type { Product } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { startOfUtcDay } from "@/lib/bank-clock";
import { prisma } from "@/lib/prisma";
import { toYahooSymbol } from "@/lib/bank-products";

export const chartRanges = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
export type ChartRange = (typeof chartRanges)[number];

export function isChartRange(value: string): value is ChartRange {
  return chartRanges.some((range) => range === value);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_TTL_MS = 15 * 60 * 1000;
const INTRADAY_INTERVAL = "15m";
const INTRADAY_SNAPSHOT_DAYS = 59;
// Days of daily history shown for each range; 1D and 1W read the intraday snapshot.
const dailyWindowDays: Partial<Record<ChartRange, number>> = { "1M": 30, "3M": 90, "1Y": 365 };

type YahooChartResponse = {
  chart?: {
    error?: { description?: string; code?: string } | null;
    result?: Array<{
      meta?: { currency?: string; longName?: string; shortName?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    } | null>;
  };
};

export type MarketPoint = { t: Date; v: number };

export class MarketDataError extends Error {}

type YahooSeries = { points: MarketPoint[]; currency?: string; name?: string };

async function fetchYahooSeries(ticker: string, yahooRange: string, interval: string): Promise<YahooSeries> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  if (yahooRange === "max") {
    // range=max silently coarsens old history to monthly bars; an explicit period keeps the requested interval.
    url.searchParams.set("period1", "0");
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
  } else {
    url.searchParams.set("range", yahooRange);
  }
  url.searchParams.set("interval", interval);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 VybeVentureMockBank/1.0" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new MarketDataError(error instanceof Error ? `Yahoo Finance request failed: ${error.message}` : "Yahoo Finance request failed.");
  }
  if (!response.ok) throw new MarketDataError(`Yahoo Finance returned HTTP ${response.status} for ${ticker}.`);

  let payload: YahooChartResponse;
  try {
    payload = await response.json() as YahooChartResponse;
  } catch {
    throw new MarketDataError(`Yahoo Finance returned invalid data for ${ticker}.`);
  }
  const chart = payload.chart;
  const result = chart?.result?.[0];
  if (chart?.error || !result) {
    throw new MarketDataError(chart?.error?.description ?? `Yahoo Finance has no price history for ${ticker}.`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points = timestamps.flatMap((timestamp, index) => {
    const price = closes[index];
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return [];
    return [{ t: new Date(timestamp * 1000), v: price }];
  });
  if (points.length === 0) throw new MarketDataError(`Yahoo Finance returned no ${interval} prices for ${ticker}.`);
  return { points, currency: result.meta?.currency, name: result.meta?.longName ?? result.meta?.shortName };
}

// Stores the downloaded bars. The last few bars of an earlier download may have been partial, so they are rewritten.
async function storeBars(symbol: string, interval: "DAILY" | "INTRADAY", points: MarketPoint[]) {
  const latest = await prisma.priceBar.findFirst({ where: { symbol, interval }, orderBy: { t: "desc" }, select: { t: true } });
  const tailStart = points[Math.max(0, points.length - 5)].t;
  const cut = latest ? new Date(Math.min(latest.t.getTime(), tailStart.getTime())) : points[0].t;
  const fresh = points.filter(({ t }) => t >= cut);
  const CHUNK = 5_000;
  await prisma.priceBar.deleteMany({ where: { symbol, interval, t: { gte: cut } } });
  for (let start = 0; start < fresh.length; start += CHUNK) {
    await prisma.priceBar.createMany({
      data: fresh.slice(start, start + CHUNK).map(({ t, v }) => ({ symbol, interval, t, close: v.toFixed(6) })),
      skipDuplicates: true,
    });
  }
}

// Downloads market data when the snapshot is missing, or when it was taken before the server time and is older than 15 minutes.
// Data for server times already inside the snapshot is never downloaded again.
async function ensureSnapshot(product: Product, now: Date) {
  const realNow = Date.now();
  const isStale = (syncedAt: Date | null) =>
    syncedAt === null || (now > syncedAt && realNow - syncedAt.getTime() > SYNC_TTL_MS);
  const ticker = toYahooSymbol(product.symbol);
  const updates: Prisma.ProductUpdateInput = {};
  let currency: string | undefined;
  let name: string | undefined;

  for (const [interval, syncedAt, yahooRange, yahooInterval, field] of [
    ["DAILY", product.dailySyncedAt, "max", "1d", "dailySyncedAt"],
    ["INTRADAY", product.intradaySyncedAt, "60d", INTRADAY_INTERVAL, "intradaySyncedAt"],
  ] as const) {
    if (!isStale(syncedAt)) continue;
    try {
      const series = await fetchYahooSeries(ticker, yahooRange, yahooInterval);
      await storeBars(product.symbol, interval, series.points);
      updates[field] = new Date();
      currency ??= series.currency;
      name ??= series.name;
    } catch (error) {
      // Stored bars keep working; only a product that has never been downloaded fails.
      if (syncedAt === null && interval === "DAILY") throw error;
      console.error(`Could not refresh ${interval.toLowerCase()} prices for ${product.symbol}:`, error);
    }
  }

  if (Object.keys(updates).length === 0) return product;
  return prisma.product.update({
    where: { symbol: product.symbol },
    data: { ...updates, ...(currency ? { currency } : {}), ...(name ? { name } : {}) },
  });
}

const toPoint = (bar: { t: Date; close: Prisma.Decimal }): MarketPoint => ({ t: bar.t, v: Number(bar.close) });

export type MarketQuote = {
  currency: string;
  name: string;
  currentPrice: number;
  previousClose: number | null;
  // Time of the price bar the quote comes from, never later than the server time.
  asOf: Date;
};

export type MarketSnapshot = MarketQuote & { points: MarketPoint[]; interval: string };

// A daily bar is stamped with the market open of its day and holds that day's close, so it is only known once the next UTC day starts.
async function latestPrice(symbol: string, now: Date) {
  const dailyCutoff = startOfUtcDay(now);
  const [daily, intraday] = await Promise.all([
    prisma.priceBar.findFirst({ where: { symbol, interval: "DAILY", t: { lt: dailyCutoff } }, orderBy: { t: "desc" } }),
    prisma.priceBar.findFirst({ where: { symbol, interval: "INTRADAY", t: { lte: now } }, orderBy: { t: "desc" } }),
  ]);
  const latest = [daily, intraday].filter((bar) => bar !== null).sort((a, b) => b.t.getTime() - a.t.getTime())[0];
  return latest ? toPoint(latest) : null;
}

async function loadQuoteForProduct(product: Product, now: Date): Promise<{ quote: MarketQuote; product: Product }> {
  const synced = await ensureSnapshot(product, now);
  const latest = await latestPrice(synced.symbol, now);
  if (!latest) {
    throw new MarketDataError(`${synced.symbol} has no price data as of ${now.toISOString()}.`);
  }
  const previous = await prisma.priceBar.findFirst({
    where: { symbol: synced.symbol, interval: "DAILY", t: { lt: startOfUtcDay(latest.t) } },
    orderBy: { t: "desc" },
    select: { close: true },
  });
  return {
    product: synced,
    quote: {
      currency: synced.currency,
      name: synced.name,
      currentPrice: latest.v,
      previousClose: previous ? Number(previous.close) : null,
      asOf: latest.t,
    },
  };
}

// Price, previous close, and quote time of a product as of the given server time.
export async function loadMarketQuote(product: Product, now: Date): Promise<MarketQuote> {
  return (await loadQuoteForProduct(product, now)).quote;
}

// Quote plus the price series for a chart range, ending at the server time.
export async function loadMarketSnapshot(product: Product, range: ChartRange, now: Date): Promise<MarketSnapshot> {
  const { quote, product: synced } = await loadQuoteForProduct(product, now);
  const symbol = synced.symbol;
  const dailyCutoff = startOfUtcDay(now);
  const dailyBars = (from?: Date) => prisma.priceBar.findMany({
    where: { symbol, interval: "DAILY", t: { ...(from ? { gte: from } : {}), lt: dailyCutoff } },
    orderBy: { t: "asc" },
  });
  const intradayBars = (from: Date) => prisma.priceBar.findMany({
    where: { symbol, interval: "INTRADAY", t: { gte: from, lte: now } },
    orderBy: { t: "asc" },
  });

  let points: MarketPoint[];
  let interval = "1d";
  if (range === "1D" || range === "1W") {
    // 1D is the latest trading day available at the server time, 1W the 7 days before it.
    const from = range === "1D" ? startOfUtcDay(quote.asOf) : new Date(now.getTime() - 7 * DAY_MS);
    points = (await intradayBars(from)).map(toPoint);
    interval = INTRADAY_INTERVAL;
    if (points.length === 0) {
      // The server time is older than the 60-day intraday snapshot; fall back to daily closes.
      const daily = (await dailyBars(new Date(now.getTime() - (range === "1D" ? 7 : 8) * DAY_MS))).map(toPoint);
      points = range === "1D" ? daily.slice(-2) : daily;
      interval = "1d";
    }
  } else {
    const days = dailyWindowDays[range];
    const windowStart = days ? new Date(now.getTime() - days * DAY_MS) : undefined;
    points = (await dailyBars(windowStart)).map(toPoint);
    if (range === "1M" || range === "3M") {
      // Daily closes alone are too sparse for 1M/3M, so the span covered by the intraday snapshot uses its denser bars.
      const intradayFrom = new Date(Math.max(windowStart?.getTime() ?? 0, now.getTime() - INTRADAY_SNAPSHOT_DAYS * DAY_MS));
      const intraday = (await intradayBars(intradayFrom)).map(toPoint);
      if (intraday.length > 0) {
        points = [...points.filter(({ t }) => t < intraday[0].t), ...intraday];
        interval = INTRADAY_INTERVAL;
      }
    }
    if (points.length === 0 || points[points.length - 1].t < quote.asOf) points.push({ t: quote.asOf, v: quote.currentPrice });
  }
  if (points.length === 0) points = [{ t: quote.asOf, v: quote.currentPrice }];
  return { ...quote, points, interval };
}

export function summarizePoints(points: MarketPoint[]) {
  if (points.length === 0) {
    return { start: 0, end: 0, change: 0, changePercent: 0, high: 0, low: 0 };
  }
  const start = points[0].v;
  const end = points[points.length - 1].v;
  const high = Math.max(...points.map(({ v }) => v));
  const low = Math.min(...points.map(({ v }) => v));
  const change = end - start;
  return {
    start,
    end,
    change,
    changePercent: start === 0 ? 0 : (change / start) * 100,
    high,
    low,
  };
}

export function downsamplePoints(points: MarketPoint[], maximum = 400) {
  if (points.length <= maximum) return points;
  const bucketSize = Math.ceil(points.length / maximum);
  return points.filter((_, index) => index === points.length - 1 || index % bucketSize === bucketSize - 1);
}

export function calculateVolatility(points: MarketPoint[]) {
  const returns = points.slice(1).flatMap((point, index) => {
    const previous = points[index].v;
    return previous > 0 ? [(point.v / previous) - 1] : [];
  });
  if (returns.length <= 20) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

export function calculateMaxDrawdown(points: MarketPoint[]) {
  let peak = 0;
  let maximumDrawdown = 0;
  for (const { v } of points) {
    peak = Math.max(peak, v);
    if (peak > 0) maximumDrawdown = Math.min(maximumDrawdown, (v / peak - 1) * 100);
  }
  return maximumDrawdown;
}

export function percentReturn(points: MarketPoint[], days: number) {
  if (points.length < 2) return 0;
  const current = points[points.length - 1];
  const boundary = current.t.getTime() - days * 24 * 60 * 60 * 1000;
  const earlier = points.find(({ t }) => t.getTime() >= boundary) ?? points[0];
  return earlier.v === 0 ? 0 : ((current.v / earlier.v) - 1) * 100;
}

// Null when the history does not reach back far enough (a few days of slack for weekends and holidays).
export function periodReturn(points: MarketPoint[], days: number) {
  if (points.length < 2) return null;
  const current = points[points.length - 1];
  const boundary = current.t.getTime() - days * 24 * 60 * 60 * 1000;
  if (points[0].t.getTime() > boundary + 5 * 24 * 60 * 60 * 1000) return null;
  const earlier = points.find(({ t }) => t.getTime() >= boundary) ?? points[0];
  return earlier.v === 0 ? null : ((current.v / earlier.v) - 1) * 100;
}
