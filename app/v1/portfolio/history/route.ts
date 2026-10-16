import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders, ensureBankAccount, userIdFromRequest } from "@/lib/bank-api";
import {
  downsamplePoints,
  isChartRange,
  loadMarketSnapshot,
  MarketDataError,
  summarizePoints,
  type MarketPoint,
} from "@/lib/bank-market-data";
import { getServerTime } from "@/lib/bank-clock";
import { parseAccountRef } from "@/lib/bank-orders";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;
  const rangeValue = new URL(request.url).searchParams.get("range")?.toUpperCase() ?? "1M";
  if (!isChartRange(rangeValue)) return apiError(400, "INVALID_REQUEST", "Unknown chart range.");
  const range = rangeValue;
  const accountRef = parseAccountRef(new URL(request.url).searchParams.get("accountRef"));
  if (!accountRef.ok) return apiError(400, "INVALID_REQUEST", "accountRef must be a string of at most 128 characters.");
  // With an accountRef the series is the holdings value of that planning account only (no cash).
  const filtered = accountRef.value !== undefined;
  const inScope = (order: { accountRef: string }) => !filtered || order.accountRef === accountRef.value;

  try {
    const now = await getServerTime();
    const account = await ensureBankAccount(identity.userId);
    // Only orders placed up to the server time take part in the replay.
    const orders = await prisma.bankOrder.findMany({
      where: { userId: identity.userId, status: "FILLED", createdAt: { lte: now } },
      orderBy: { createdAt: "asc" },
    });
    const symbols = [...new Set(orders.filter(inScope).map(({ symbol }) => symbol))];
    const products = symbols.length ? await prisma.product.findMany({ where: { symbol: { in: symbols } } }) : [];
    const marketBySymbol = new Map<string, MarketPoint[]>();
    const intervals = new Set<string>();
    await Promise.all(products.map(async (product) => {
      const market = await loadMarketSnapshot(product, range, now);
      if (market.currency !== account.currency) {
        throw new Error(`Cannot value ${product.symbol} in ${account.currency}; FX conversion is not configured.`);
      }
      marketBySymbol.set(product.symbol, market.points);
      intervals.add(market.interval);
    }));

    const quoteTimes = [...marketBySymbol.values()].flatMap((points) => points.map(({ t }) => t.getTime()));
    if (quoteTimes.length === 0) {
      return NextResponse.json({
        range,
        interval: range === "1D" || range === "1W" ? "15m" : "1d",
        currency: account.currency,
        asOf: now.toISOString(),
        points: [],
        summary: null,
      }, { headers: apiSuccessHeaders() });
    }

    const earliestQuote = Math.max(...[...marketBySymbol.values()].map((points) => points[0].t.getTime()));
    const eventTimes = orders
      .filter(inScope)
      .map(({ createdAt }) => createdAt.getTime())
      .filter((time) => time >= earliestQuote);
    const timeSet = new Set([...quoteTimes, ...eventTimes]);
    const sortedTimes = [...timeSet].sort((left, right) => left - right);
    const seriesCursors = new Map<string, number>();
    const latestPrices = new Map<string, number>();
    const quantities = new Map<string, number>();
    let cash = Number(account.openingCashBalance);
    let orderIndex = 0;
    const portfolioPoints: MarketPoint[] = [];

    for (const time of sortedTimes) {
      while (orderIndex < orders.length && orders[orderIndex].createdAt.getTime() <= time) {
        const order = orders[orderIndex];
        const quantity = Number(order.quantity);
        const change = order.side === "BUY" ? quantity : -quantity;
        if (inScope(order)) quantities.set(order.symbol, (quantities.get(order.symbol) ?? 0) + change);
        cash += order.side === "BUY" ? -Number(order.total) : Number(order.total);
        orderIndex += 1;
      }

      for (const symbol of symbols) {
        const points = marketBySymbol.get(symbol) ?? [];
        let cursor = seriesCursors.get(symbol) ?? 0;
        while (cursor < points.length && points[cursor].t.getTime() <= time) {
          latestPrices.set(symbol, points[cursor].v);
          cursor += 1;
        }
        seriesCursors.set(symbol, cursor);
      }

      let value = filtered ? 0 : cash;
      for (const symbol of symbols) {
        const quantity = quantities.get(symbol) ?? 0;
        const price = latestPrices.get(symbol);
        if (quantity > 0 && price !== undefined) value += quantity * price;
      }
      portfolioPoints.push({ t: new Date(time), v: value });
    }

    const allPoints = portfolioPoints.filter(({ v }) => Number.isFinite(v));
    return NextResponse.json({
      range,
      interval: intervals.size === 1 ? [...intervals][0] : "mixed",
      currency: account.currency,
      asOf: now.toISOString(),
      points: downsamplePoints(allPoints).map(({ t, v }) => ({ t: t.toISOString(), v })),
      summary: allPoints.length ? summarizePoints(allPoints) : null,
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error(`Failed to calculate portfolio history for ${identity.userId}:`, error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", "Unable to calculate portfolio history.")
      : apiError(500, "INTERNAL_ERROR", "Unable to calculate portfolio history.");
  }
}
