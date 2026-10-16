import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import {
  downsamplePoints,
  isChartRange,
  MarketDataError,
  loadMarketSnapshot,
  summarizePoints,
} from "@/lib/bank-market-data";
import { getServerTime } from "@/lib/bank-clock";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const symbol = (await context.params).symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return apiError(400, "INVALID_REQUEST", "A valid product symbol is required.");
  const value = new URL(request.url).searchParams.get("range")?.toUpperCase() ?? "1M";
  if (!isChartRange(value)) return apiError(400, "INVALID_REQUEST", "Unknown chart range.");

  try {
    const product = await prisma.product.findUnique({ where: { symbol }, });
    if (!product) return apiError(404, "PRODUCT_NOT_FOUND", `No product exists with symbol ${symbol}.`);
    const market = await loadMarketSnapshot(product, value, await getServerTime());
    const summary = summarizePoints(market.points);
    return NextResponse.json({
      symbol,
      range: value,
      interval: market.interval,
      currency: market.currency,
      asOf: market.asOf.toISOString(),
      points: downsamplePoints(market.points).map(({ t, v }) => ({ t: t.toISOString(), v })),
      summary,
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error(`Failed to load price history for ${symbol}:`, error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", "Unable to load product price history.")
      : apiError(500, "INTERNAL_ERROR", "Unable to load product price history.");
  }
}
