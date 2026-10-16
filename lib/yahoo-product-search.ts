import type { ProductRisk, ProductType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerTime } from "@/lib/bank-clock";
import { MarketDataError, loadMarketQuote } from "@/lib/bank-market-data";

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  typeDisp?: string;
};

type YahooSearchResponse = {
  quotes?: YahooQuote[];
};

export type YahooProductMatch = {
  symbol: string;
  name: string;
  type: ProductType;
  exchange: string;
  description: string;
  inCatalog: boolean;
};
type YahooSearchMatch = Omit<YahooProductMatch, "inCatalog">;

function productType(quoteType: string | undefined): ProductType | null {
  switch (quoteType?.toUpperCase()) {
    case "EQUITY":
    case "STOCK":
      return "STOCK";
    case "ETF":
    case "MUTUALFUND":
      return "FUND";
    case "BOND":
      return "BOND";
    case "CRYPTOCURRENCY":
    case "CRYPTO":
      return "CRYPTO";
    default:
      return null;
  }
}

async function yahooSearch(query: string): Promise<YahooSearchMatch[]> {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "20");
  url.searchParams.set("newsCount", "0");
  url.searchParams.set("enableFuzzyQuery", "false");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 VybeVentureMockBank/1.0" },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 },
    });
  } catch (error) {
    throw new MarketDataError(error instanceof Error ? `Yahoo Finance search failed: ${error.message}` : "Yahoo Finance search failed.");
  }
  if (!response.ok) throw new MarketDataError(`Yahoo Finance search returned HTTP ${response.status}.`);

  let payload: YahooSearchResponse;
  try {
    payload = await response.json() as YahooSearchResponse;
  } catch {
    throw new MarketDataError("Yahoo Finance search returned invalid data.");
  }

  return (payload.quotes ?? []).flatMap((quote): YahooSearchMatch[] => {
    const symbol = quote.symbol?.trim().toUpperCase() ?? "";
    const type = productType(quote.quoteType);
    if (!/^[A-Z0-9.-]{1,12}$/.test(symbol) || !type) return [];
    const name = quote.longname?.trim() || quote.shortname?.trim() || symbol;
    const exchange = quote.exchDisp?.trim() || "Market";
    return [{
      symbol,
      name,
      type,
      exchange,
      description: `${name} is a ${type.toLowerCase()} listed on ${exchange}.`,
    }];
  });
}

export async function searchYahooProducts(query: string) {
  const matches = await yahooSearch(query);
  if (matches.length === 0) return matches;
  const existing = await prisma.product.findMany({
    where: { symbol: { in: matches.map(({ symbol }) => symbol) } },
    select: { symbol: true },
  });
  const existingSymbols = new Set(existing.map(({ symbol }) => symbol));
  return matches.map((match) => ({ ...match, inCatalog: existingSymbols.has(match.symbol) }));
}

export async function addYahooProduct(symbol: string) {
  const matches = await yahooSearch(symbol);
  const match = matches.find((result) => result.symbol === symbol.toUpperCase());
  if (!match) throw new ProductNotFoundError(`Yahoo Finance did not return a supported investment for ${symbol}.`);

  const risk: ProductRisk = match.type === "CRYPTO" ? "HIGH" : "MEDIUM";
  const product = await prisma.product.upsert({
    where: { symbol: match.symbol },
    create: {
      symbol: match.symbol,
      name: match.name,
      type: match.type,
      area: match.type === "CRYPTO" ? "Crypto" : "Other",
      description: match.description,
      risk,
      riskNote: match.type === "CRYPTO"
        ? "Crypto assets can be extremely volatile and may lose most or all of their value."
        : "Investment values may fluctuate and can fall; review the product information before making decisions.",
      issuer: match.exchange,
      region: "Global",
    },
    update: {
      name: match.name,
      description: match.description,
      issuer: match.exchange,
    },
  });

  const market = await loadMarketQuote(product, await getServerTime());
  const savedProduct = await prisma.product.findUniqueOrThrow({ where: { symbol: match.symbol } });
  return {
    symbol: savedProduct.symbol,
    name: market.name ?? savedProduct.name,
    type: savedProduct.type,
    area: savedProduct.area,
    description: savedProduct.description,
    risk: savedProduct.risk,
    currentPrice: market.currentPrice,
    dayChange: market.currentPrice - (market.previousClose ?? market.currentPrice),
    dayChangePercent: market.previousClose
      ? ((market.currentPrice / market.previousClose) - 1) * 100
      : 0,
    asOf: market.asOf.toISOString(),
    currency: market.currency,
  };
}

export class ProductNotFoundError extends Error {}
