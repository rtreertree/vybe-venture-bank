import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders, ensureBankAccount, userIdFromRequest } from "@/lib/bank-api";
import { getServerTime } from "@/lib/bank-clock";
import { loadMarketQuote, MarketDataError } from "@/lib/bank-market-data";
import { parseAccountRef } from "@/lib/bank-orders";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function GET(request: Request) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;

  const accountRef = parseAccountRef(new URL(request.url).searchParams.get("accountRef"));
  if (!accountRef.ok) return apiError(400, "INVALID_REQUEST", "accountRef must be a string of at most 128 characters.");

  try {
    const account = await ensureBankAccount(identity.userId);
    const holdings = await prisma.holding.findMany({
      where: {
        userId: identity.userId,
        quantity: { gt: 0 },
        ...(accountRef.value !== undefined ? { accountRef: accountRef.value } : {}),
      },
      include: { product: true },
      orderBy: [{ symbol: "asc" }, { accountRef: "asc" }],
    });
    const now = await getServerTime();
    const priced = await Promise.all(holdings.map(async (holding) => ({
      holding,
      market: await loadMarketQuote(holding.product, now),
    })));
    // Holding period runs from the first buy to the server time.
    const firstBuys = holdings.length
      ? await prisma.bankOrder.groupBy({
        by: ["accountRef", "symbol"],
        where: { userId: identity.userId, status: "FILLED", side: "BUY", symbol: { in: holdings.map(({ symbol }) => symbol) } },
        _min: { createdAt: true },
      })
      : [];
    const firstBuyAt = new Map(firstBuys.map((group) => [`${group.accountRef}:${group.symbol}`, group._min.createdAt]));

    let holdingsValue = 0;
    let totalCost = 0;
    const rows = priced.map(({ holding, market }) => {
      if (market.currency !== account.currency) {
        throw new Error(`Cannot value ${holding.symbol} in ${account.currency}; FX conversion is not configured.`);
      }
      const quantity = Number(holding.quantity);
      const avgCost = Number(holding.avgCost);
      const currentPrice = market.currentPrice;
      const marketValue = round2(quantity * currentPrice);
      const cost = round2(quantity * avgCost);
      holdingsValue += marketValue;
      totalCost += cost;
      const boughtAt = firstBuyAt.get(`${holding.accountRef}:${holding.symbol}`) ?? null;
      return {
        symbol: holding.symbol,
        name: market.name ?? holding.product.name,
        area: holding.product.area,
        accountRef: holding.accountRef || null,
        quantity,
        avgCost,
        currentPrice,
        marketValue,
        unrealizedPL: round2(marketValue - cost),
        unrealizedPLPercent: cost === 0 ? 0 : round2(((marketValue - cost) / cost) * 100),
        asOf: market.asOf.toISOString(),
        boughtAt: boughtAt?.toISOString() ?? null,
        heldDays: boughtAt ? Math.max(0, Math.floor((now.getTime() - boughtAt.getTime()) / 86_400_000)) : null,
        weightPercent: 0,
      };
    });
    const cashBalance = Number(account.cashBalance);
    const totalValue = cashBalance + holdingsValue;
    const unrealizedPL = holdingsValue - totalCost;

    return NextResponse.json({
      currency: account.currency,
      asOf: now.toISOString(),
      ...(accountRef.value !== undefined ? { accountRef: accountRef.value } : {}),
      cashBalance,
      holdings: rows.map((holding) => ({
        ...holding,
        weightPercent: holdingsValue === 0 ? 0 : round2((holding.marketValue / holdingsValue) * 100),
      })),
      totals: {
        holdingsValue: round2(holdingsValue),
        totalValue: round2(totalValue),
        totalCost: round2(totalCost),
        unrealizedPL: round2(unrealizedPL),
        unrealizedPLPercent: totalCost === 0 ? 0 : round2((unrealizedPL / totalCost) * 100),
      },
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error(`Failed to load portfolio for ${identity.userId}:`, error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", "Unable to value the portfolio at current market prices.")
      : apiError(500, "INTERNAL_ERROR", "Unable to load the portfolio.");
  }
}
