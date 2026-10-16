import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import {
  calculateMaxDrawdown,
  calculateVolatility,
  MarketDataError,
  loadMarketSnapshot,
  periodReturn,
} from "@/lib/bank-market-data";
import { getServerTime } from "@/lib/bank-clock";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const symbol = (await context.params).symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return apiError(400, "INVALID_REQUEST", "A valid product symbol is required.");

  try {
    const product = await prisma.product.findUnique({ where: { symbol } });
    if (!product) return apiError(404, "PRODUCT_NOT_FOUND", `No product exists with symbol ${symbol}.`);
    const market = await loadMarketSnapshot(product, "ALL", await getServerTime());
    const prices = market.points;
    const yearAgo = new Date(market.asOf.getTime() - 365 * 24 * 60 * 60 * 1000);
    const yearPoints = prices.filter(({ t }) => t >= yearAgo);
    const currentPrice = market.currentPrice;
    const previousClose = market.previousClose ?? currentPrice;

    return NextResponse.json({
      symbol: product.symbol,
      name: market.name ?? product.name,
      type: product.type.toLowerCase(),
      area: product.area,
      description: product.description,
      risk: product.risk.toLowerCase(),
      riskNote: product.riskNote,
      currency: market.currency,
      issuer: product.issuer,
      region: product.region,
      currentPrice,
      dayChange: currentPrice - previousClose,
      dayChangePercent: previousClose === 0 ? 0 : ((currentPrice - previousClose) / previousClose) * 100,
      returns: {
        "1M": periodReturn(prices, 30),
        "3M": periodReturn(prices, 90),
        "1Y": periodReturn(prices, 365),
        "3Y": periodReturn(prices, 1095),
      },
      volatilityPercent: calculateVolatility(yearPoints.slice(-253)),
      maxDrawdownPercent: calculateMaxDrawdown(yearPoints),
      high52w: yearPoints.length ? Math.max(...yearPoints.map(({ v }) => v)) : currentPrice,
      low52w: yearPoints.length ? Math.min(...yearPoints.map(({ v }) => v)) : currentPrice,
      dividendYieldPercent: Number(product.dividendYieldPercent),
      size: product.size === null ? null : Number(product.size),
      inceptionDate: product.inceptionDate?.toISOString().slice(0, 10) ?? null,
      topHoldings: Array.isArray(product.topHoldings) ? product.topHoldings : [],
      asOf: market.asOf.toISOString(),
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error(`Failed to load product detail for ${symbol}:`, error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", "Unable to load current product pricing.")
      : apiError(500, "INTERNAL_ERROR", "Unable to load product details.");
  }
}
