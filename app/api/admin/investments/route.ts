import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId")?.trim();
  if (userId && userId.length > 120) {
    return NextResponse.json({ error: "User ID must be no more than 120 characters." }, { status: 400 });
  }

  try {
    const users = await prisma.investmentTrade.findMany({
      distinct: ["userId"],
      select: { userId: true },
      orderBy: { userId: "asc" },
    });
    const userNames = await prisma.user.findMany({
      where: { id: { in: users.map(({ userId }) => userId) } },
      select: { id: true, name: true },
    });
    const namesById = new Map(userNames.map(({ id, name }) => [id, name]));
    const usersWithNames = users.map(({ userId }) => ({
      userId,
      name: namesById.get(userId) ?? null,
    }));

    if (!userId) {
      return NextResponse.json({ users: usersWithNames }, { headers: { "Cache-Control": "no-store" } });
    }

    const trades = await prisma.investmentTrade.findMany({
      where: { userId },
      orderBy: { tradedAt: "asc" },
      take: 5_000,
    });

    return NextResponse.json({
      users: usersWithNames,
      trades: trades.map((trade) => ({
        ...trade,
        unitPrice: Number(trade.unitPrice),
        totalAmount: Number(trade.totalAmount),
      })),
      truncated: trades.length === 5_000,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin investment overview:", error);
    return NextResponse.json(
      { error: "Unable to load investment data. Check the database connection and apply pending migrations." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
