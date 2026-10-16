import { NextResponse } from "next/server";
import { getServerTime } from "@/lib/bank-clock";
import { pricesAtServerTime } from "@/lib/option-pricing";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: userId } = await params;
  if (!userId.trim() || userId.length > 120) {
    return NextResponse.json({ error: "User ID must be between 1 and 120 characters." }, { status: 400 });
  }

  try {
    const now = await getServerTime();
    const [user, trades] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      }),
      prisma.investmentTrade.findMany({
        where: { userId, tradedAt: { lte: now } },
        orderBy: { tradedAt: "asc" },
        take: 5_000,
      }),
    ]);

    if (!user && trades.length === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const earliestTrade = trades[0]?.tradedAt ?? null;
    const positions = new Map<string, { symbol: string; assetType: string; quantity: number; lastPrice: number }>();
    for (const trade of trades) {
      const key = `${trade.symbol}:${trade.assetType}`;
      const position = positions.get(key) ?? {
        symbol: trade.symbol,
        assetType: trade.assetType,
        quantity: 0,
        lastPrice: Number(trade.unitPrice),
      };
      position.quantity += trade.side === "BUY" ? trade.quantity : -trade.quantity;
      position.lastPrice = Number(trade.unitPrice);
      positions.set(key, position);
    }

    const open = [...positions.values()].filter((position) => position.quantity > 0.000001);
    const marketPrices = await pricesAtServerTime(open.map(({ symbol }) => symbol), now);
    const holdings = open.map((position) => {
      // Valued at the market price on the server time, not at the price of the last trade.
      const currentPrice = marketPrices.get(position.symbol)?.price ?? position.lastPrice;
      return {
        symbol: position.symbol,
        asset_type: position.assetType,
        quantity: position.quantity,
        last_trade_price: position.lastPrice,
        current_price: currentPrice,
        price_as_of: marketPrices.get(position.symbol)?.asOf ?? null,
        estimated_value: Math.round(position.quantity * currentPrice * 100) / 100,
      };
    });

    return NextResponse.json({
      server_time: now.toISOString(),
      user: {
        id: user?.id ?? userId,
        email: user?.email ?? null,
        name: user?.name ?? null,
        created_at: user?.createdAt ?? earliestTrade,
        updated_at: user?.updatedAt ?? null,
      },
      investment_summary: {
        trade_count: trades.length,
        buy_count: trades.filter((trade) => trade.side === "BUY").length,
        sell_count: trades.filter((trade) => trade.side === "SELL").length,
        position_count: holdings.length,
        estimated_portfolio_value: Math.round(holdings.reduce((sum, holding) => sum + holding.estimated_value, 0) * 100) / 100,
      },
      holdings,
      recent_transactions: [...trades].reverse().slice(0, 20).map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        asset_type: trade.assetType,
        side: trade.side,
        quantity: trade.quantity,
        unit_price: Number(trade.unitPrice),
        total_amount: Number(trade.totalAmount),
        timestamp: trade.tradedAt,
      })),
      truncated: trades.length === 5_000,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to fetch mock user details:", error);
    return NextResponse.json(
      { error: "Unable to load user details. Check the database connection and apply pending migrations." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
