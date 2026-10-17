import { NextResponse } from "next/server";
import type { InvestmentSide } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerTime } from "@/lib/bank-clock";
import { findMockInvestmentOption } from "@/lib/mock-investment-options";
import { pricesAtServerTime } from "@/lib/option-pricing";
import { isPrismaErrorCode, withSerializableRetry } from "@/lib/transaction-retry";

export async function createInvestmentTransaction(request: Request, side: InvestmentSide) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "option_id, user_id, and quantity are required." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const optionId = typeof input.option_id === "string" ? input.option_id.trim() : "";
  const userId = typeof input.user_id === "string" ? input.user_id.trim() : "";
  const quantity = input.quantity;
  const option = findMockInvestmentOption(optionId);

  if (!option) {
    return NextResponse.json({ error: "option_id must match an option returned by GET /options." }, { status: 400 });
  }
  if (!userId || userId.length > 120) {
    return NextResponse.json({ error: "user_id must be between 1 and 120 characters." }, { status: 400 });
  }
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return NextResponse.json({ error: "quantity must be greater than 0 and no more than 1,000,000." }, { status: 400 });
  }

  try {
    // Trades are stamped with the server time and priced from the market snapshot at that time.
    const tradedAt = await getServerTime();
    const unitPrice = (await pricesAtServerTime([option.symbol], tradedAt)).get(option.symbol)?.price ?? option.mock_price;
    const totalAmount = Math.round(unitPrice * quantity * 100) / 100;

    const trade = await withSerializableRetry(() => prisma.$transaction(async (transaction) => {
      if (side === "SELL") {
        const previousTrades = await transaction.investmentTrade.findMany({
          where: { userId, symbol: option.symbol, assetType: option.asset_type },
          select: { side: true, quantity: true },
        });
        const ownedQuantity = previousTrades.reduce(
          (total, previousTrade) => previousTrade.side === "BUY" ? total.add(previousTrade.quantity) : total.sub(previousTrade.quantity),
          new Prisma.Decimal(0),
        );

        if (new Prisma.Decimal(quantity).gt(ownedQuantity)) {
          throw new InsufficientQuantityError(ownedQuantity.toNumber());
        }
      }

      return transaction.investmentTrade.create({
        data: {
          userId,
          symbol: option.symbol,
          assetType: option.asset_type,
          side,
          quantity,
          unitPrice: unitPrice.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          tradedAt,
        },
      });
    }, { isolationLevel: "Serializable" }));

    return NextResponse.json({
      transaction: {
        id: trade.id,
        user_id: trade.userId,
        option_id: option.option_id,
        symbol: trade.symbol,
        asset_type: trade.assetType,
        side: trade.side,
        quantity: trade.quantity,
        unit_price: Number(trade.unitPrice),
        total_amount: Number(trade.totalAmount),
        currency: option.currency,
        timestamp: trade.tradedAt,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InsufficientQuantityError) {
      return NextResponse.json(
        { error: `Cannot sell ${quantity} units; only ${error.availableQuantity} are currently owned.` },
        { status: 400 },
      );
    }
    if (isPrismaErrorCode(error, "P2034")) {
      return NextResponse.json({ error: "The account is busy. Try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    console.error(`Failed to record mock ${side.toLowerCase()} transaction:`, error);
    return NextResponse.json(
      { error: "Unable to record transaction. Check the database connection and apply pending migrations." },
      { status: 500 },
    );
  }
}

class InsufficientQuantityError extends Error {
  constructor(readonly availableQuantity: number) {
    super("Insufficient owned quantity");
  }
}
