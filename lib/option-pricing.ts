import { loadMarketQuote } from "@/lib/bank-market-data";
import { mockInvestmentOptions } from "@/lib/mock-investment-options";
import { prisma } from "@/lib/prisma";

export type PriceAtServerTime = { price: number; asOf: string | null };

const round2 = (value: number) => Math.round(value * 100) / 100;

// Prices for the given symbols as of the server time. A symbol with no stored or downloadable market data is left out.
export async function pricesAtServerTime(symbols: string[], now: Date) {
  const prices = new Map<string, PriceAtServerTime>();
  if (symbols.length === 0) return prices;
  const products = await prisma.product.findMany({ where: { symbol: { in: symbols } } });
  await Promise.all(products.map(async (product) => {
    try {
      const quote = await loadMarketQuote(product, now);
      prices.set(product.symbol, { price: round2(quote.currentPrice), asOf: quote.asOf.toISOString() });
    } catch (error) {
      console.error(`No market price for ${product.symbol} at ${now.toISOString()}:`, error);
    }
  }));
  return prices;
}

// The option list as the bank sees it at the server time: market prices where available, the fixed mock price otherwise.
export async function pricedInvestmentOptions(now: Date) {
  const prices = await pricesAtServerTime(mockInvestmentOptions.map(({ symbol }) => symbol), now);
  return mockInvestmentOptions.map((option) => {
    const quote = prices.get(option.symbol);
    return { ...option, mock_price: quote?.price ?? option.mock_price, price_as_of: quote?.asOf ?? null };
  });
}
