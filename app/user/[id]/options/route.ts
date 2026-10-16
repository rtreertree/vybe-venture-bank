import { NextResponse } from "next/server";
import { getServerTime } from "@/lib/bank-clock";
import { pricesAtServerTime } from "@/lib/option-pricing";
import { prisma } from "@/lib/prisma";
import { mockInvestmentOptions } from "@/lib/mock-investment-options";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: userId } = await params;
  if (!userId.trim() || userId.length > 120) {
    return NextResponse.json({ error: "User ID must be between 1 and 120 characters." }, { status: 400 });
  }

  try {
    const now = await getServerTime();
    const trades = await prisma.investmentTrade.findMany({
      where: { userId, tradedAt: { lte: now } },
      orderBy: { tradedAt: "asc" },
    });
    if (trades.length === 0) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const positions = new Map<string, { quantity: number; lastPrice: number }>();
    for (const trade of trades) {
      const key = `${trade.symbol}:${trade.assetType}`;
      const position = positions.get(key) ?? { quantity: 0, lastPrice: Number(trade.unitPrice) };
      position.quantity += trade.side === "BUY" ? trade.quantity : -trade.quantity;
      position.lastPrice = Number(trade.unitPrice);
      positions.set(key, position);
    }

    const open = [...positions.entries()].filter(([, position]) => position.quantity > 0.000001);
    const marketPrices = await pricesAtServerTime(open.map(([key]) => key.split(":")[0]), now);
    const options = open
      .map(([key, position]) => {
        const [symbol, assetType] = key.split(":");
        const currentPrice = marketPrices.get(symbol)?.price ?? position.lastPrice;
        const option = mockInvestmentOptions.find(
          (candidate) => candidate.symbol === symbol && candidate.asset_type === assetType,
        );
        return {
          option_id: option?.option_id ?? `${assetType.toLowerCase()}-${symbol.toLowerCase()}`,
          symbol,
          name: option?.name ?? symbol,
          asset_type: assetType,
          currency: "USD",
          quantity: position.quantity,
          last_trade_price: position.lastPrice,
          current_price: currentPrice,
          price_as_of: marketPrices.get(symbol)?.asOf ?? null,
          estimated_value: Math.round(position.quantity * currentPrice * 100) / 100,
        };
      });

    return NextResponse.json(
      { user_id: userId, server_time: now.toISOString(), options },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to fetch user-owned mock options:", error);
    return NextResponse.json(
      { error: "Unable to load user options. Check the database connection and apply pending migrations." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
