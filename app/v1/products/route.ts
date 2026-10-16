import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import { getServerTime } from "@/lib/bank-clock";
import { loadMarketQuote, loadMarketSnapshot, MarketDataError, percentReturn } from "@/lib/bank-market-data";
import { prisma } from "@/lib/prisma";
import type { ProductRisk, ProductType } from "@/generated/prisma/client";

export const runtime = "nodejs";

const productTypes: Record<string, ProductType> = {
  stock: "STOCK",
  fund: "FUND",
  bond: "BOND",
  crypto: "CRYPTO",
  commodity: "COMMODITY",
  reit: "REIT",
};
const risks: Record<string, ProductRisk> = { low: "LOW", medium: "MEDIUM", high: "HIGH" };
const sortOptions = new Set(["name", "price", "dayChangePercent", "return1Y", "risk"]);
const riskRank: Record<ProductRisk, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const typeQuery = params.get("type")?.trim().toLowerCase();
  const riskQuery = params.get("risk")?.trim().toLowerCase();
  const sort = params.get("sort")?.trim() || "name";
  if (typeQuery && !productTypes[typeQuery]) return apiError(400, "INVALID_REQUEST", "type must be stock, fund, bond, crypto, commodity, or reit.");
  if (riskQuery && !risks[riskQuery]) return apiError(400, "INVALID_REQUEST", "risk must be low, medium, or high.");
  if (!sortOptions.has(sort)) return apiError(400, "INVALID_REQUEST", "sort must be name, price, dayChangePercent, return1Y, or risk.");

  try {
    if ((await prisma.product.count()) === 0) {
      return apiError(503, "CATALOG_NOT_READY", "The product catalog is empty. Apply migrations and run the database seed.");
    }
    const products = await prisma.product.findMany({
      where: {
        ...(typeQuery ? { type: productTypes[typeQuery] } : {}),
        ...(riskQuery ? { risk: risks[riskQuery] } : {}),
        ...(params.get("area") ? { area: { equals: params.get("area")!.trim(), mode: "insensitive" } } : {}),
        ...(params.get("q")?.trim()
          ? {
              OR: [
                { symbol: { contains: params.get("q")!.trim(), mode: "insensitive" } },
                { name: { contains: params.get("q")!.trim(), mode: "insensitive" } },
                { description: { contains: params.get("q")!.trim(), mode: "insensitive" } },
              ],
            }
          : {}),
      },
    });
    const now = await getServerTime();
    const market = await Promise.all(products.map(async (product) => ({
      product,
      prices: sort === "return1Y"
        ? await loadMarketSnapshot(product, "1Y", now)
        : { ...await loadMarketQuote(product, now), points: [] },
    })));
    const results = market.map(({ product, prices }) => {
      const currentPrice = prices.currentPrice;
      const previousClose = prices.previousClose ?? currentPrice;
      return {
        product: {
          symbol: product.symbol,
          name: prices.name ?? product.name,
          type: product.type.toLowerCase(),
          area: product.area,
          description: product.description,
          risk: product.risk.toLowerCase(),
          currentPrice,
          dayChange: currentPrice - previousClose,
          dayChangePercent: previousClose === 0 ? 0 : ((currentPrice - previousClose) / previousClose) * 100,
          asOf: prices.asOf.toISOString(),
          currency: prices.currency,
        },
        return1Y: percentReturn(prices.points, 365),
      };
    });
    const riskBySymbol = new Map(products.map(({ symbol, risk }) => [symbol, risk]));

    results.sort((left, right) => {
      switch (sort) {
        case "price": return left.product.currentPrice - right.product.currentPrice;
        case "dayChangePercent": return right.product.dayChangePercent - left.product.dayChangePercent;
        case "return1Y": return right.return1Y - left.return1Y;
        case "risk": {
          const leftRisk = riskBySymbol.get(left.product.symbol)!;
          const rightRisk = riskBySymbol.get(right.product.symbol)!;
          return riskRank[leftRisk] - riskRank[rightRisk];
        }
        default: return left.product.name.localeCompare(right.product.name);
      }
    });

    return NextResponse.json({
      asOf: now.toISOString(),
      products: results.map(({ product }) => product),
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to list bank products:", error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", "Unable to update product prices from the market data provider.")
      : apiError(500, "INTERNAL_ERROR", "Unable to list bank products.");
  }
}
