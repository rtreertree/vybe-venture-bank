import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { BankOrderStatus, InvestmentAssetType } from "@/generated/prisma/client";
import { apiError, apiSuccessHeaders, ensureBankAccount, userIdFromRequest } from "@/lib/bank-api";
import { getServerTime } from "@/lib/bank-clock";
import { loadMarketQuote, MarketDataError } from "@/lib/bank-market-data";
import { orderResponse, parseAccountRef } from "@/lib/bank-orders";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const validStatuses: Record<string, BankOrderStatus> = {
  pending: "PENDING",
  filled: "FILLED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
};
const assetTypes: Record<string, InvestmentAssetType> = {
  STOCK: "STOCK",
  FUND: "ETF",
  BOND: "BOND",
  CRYPTO: "CRYPTO",
  COMMODITY: "OTHER",
  REIT: "OTHER",
};

export async function GET(request: Request) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;
  const params = new URL(request.url).searchParams;
  const statusQuery = params.get("status")?.trim().toLowerCase();
  if (statusQuery && !validStatuses[statusQuery]) return apiError(400, "INVALID_REQUEST", "Unknown order status.");
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return apiError(400, "INVALID_REQUEST", "limit must be an integer between 1 and 200.");
  }
  const accountRef = parseAccountRef(params.get("accountRef"));
  if (!accountRef.ok) return apiError(400, "INVALID_REQUEST", "accountRef must be a string of at most 128 characters.");

  try {
    const orders = await prisma.bankOrder.findMany({
      where: {
        userId: identity.userId,
        ...(accountRef.value !== undefined ? { accountRef: accountRef.value } : {}),
        ...(statusQuery ? { status: validStatuses[statusQuery] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ orders: orders.map(orderResponse) }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error(`Failed to list orders for ${identity.userId}:`, error);
    return apiError(500, "INTERNAL_ERROR", "Unable to list orders.");
  }
}

export async function POST(request: Request) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return apiError(400, "INVALID_REQUEST", "A JSON object is required.");
  }
  const body = input as Record<string, unknown>;
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const side = typeof body.side === "string" ? body.side.trim().toLowerCase() : "";
  const orderType = typeof body.type === "string" ? body.type.trim().toLowerCase() : "market";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const hasQuantity = body.quantity !== undefined;
  const hasAmount = body.amount !== undefined;
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol) || !["buy", "sell"].includes(side) || orderType !== "market") {
    return apiError(400, "INVALID_REQUEST", "symbol, side (buy or sell), and market type are required.");
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return apiError(400, "INVALID_REQUEST", "idempotencyKey must be between 8 and 120 characters.");
  }
  if (hasQuantity === hasAmount) {
    return apiError(400, "INVALID_REQUEST", "Provide exactly one of quantity or amount.");
  }
  const requested = hasQuantity ? body.quantity : body.amount;
  const maximum = hasQuantity ? 1_000_000 : 1_000_000_000;
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0 || requested > maximum) {
    return apiError(400, "INVALID_REQUEST", `${hasQuantity ? "quantity" : "amount"} must be greater than 0 and within the supported limit.`);
  }
  const accountRefInput = parseAccountRef(body.accountRef);
  if (!accountRefInput.ok) return apiError(400, "INVALID_REQUEST", "accountRef must be a string of at most 128 characters.");
  const accountRef = accountRefInput.value ?? "";

  try {
    const existing = await prisma.bankOrder.findUnique({
      where: { userId_idempotencyKey: { userId: identity.userId, idempotencyKey } },
    });
    if (existing) return NextResponse.json(orderResponse(existing), { headers: apiSuccessHeaders() });

    const product = await prisma.product.findUnique({ where: { symbol } });
    if (!product) return apiError(404, "PRODUCT_NOT_FOUND", `No product exists with symbol ${symbol}.`);
    const now = await getServerTime();
    const market = await loadMarketQuote(product, now);
    const price = new Prisma.Decimal(market.currentPrice);
    // Spec: quantity has at most 6 decimals (amount orders round down); total is quantity x price in cents.
    const quantity = (hasQuantity
      ? new Prisma.Decimal(requested)
      : new Prisma.Decimal(requested).div(price)
    ).toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);
    if (quantity.lte(0) || quantity.gt(1_000_000)) {
      return apiError(400, "INVALID_REQUEST", "The calculated order quantity is outside the supported range.");
    }
    const total = quantity.mul(price).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const account = await ensureBankAccount(identity.userId);
    if (account.currency !== market.currency) {
      return apiError(400, "INVALID_REQUEST", `Product currency ${market.currency} does not match account currency ${account.currency}.`);
    }

    const order = await prisma.$transaction(async (transaction) => {
      const currentAccount = await transaction.bankAccount.findUnique({ where: { userId: identity.userId } });
      if (!currentAccount) throw new Error("Bank account was not initialized.");

      const holdingKey = { userId_accountRef_symbol: { userId: identity.userId, accountRef, symbol } };
      const existingHolding = await transaction.holding.findUnique({ where: holdingKey });
      const previousQuantity = existingHolding ? new Prisma.Decimal(existingHolding.quantity) : new Prisma.Decimal(0);
      const previousAverageCost = existingHolding ? new Prisma.Decimal(existingHolding.avgCost) : new Prisma.Decimal(0);
      if (side === "sell" && quantity.gt(previousQuantity)) {
        throw new InsufficientHoldingsError(previousQuantity.toNumber());
      }
      if (side === "buy" && new Prisma.Decimal(currentAccount.cashBalance).lt(total)) {
        throw new InsufficientFundsError();
      }

      const created = await transaction.bankOrder.create({
        data: {
          userId: identity.userId,
          accountRef,
          symbol,
          side: side === "buy" ? "BUY" : "SELL",
          status: "FILLED",
          quantity: quantity.toFixed(8),
          filledPrice: price.toFixed(6),
          total: total.toFixed(2),
          priceAsOf: market.asOf,
          idempotencyKey,
          createdAt: now,
        },
      });

      if (side === "buy") {
        const newQuantity = previousQuantity.add(quantity);
        const averageCost = previousQuantity.mul(previousAverageCost).add(quantity.mul(price)).div(newQuantity);
        await transaction.bankAccount.update({
          where: { userId: identity.userId },
          data: { cashBalance: { decrement: total.toFixed(2) } },
        });
        await transaction.holding.upsert({
          where: holdingKey,
          create: {
            userId: identity.userId,
            accountRef,
            symbol,
            quantity: quantity.toFixed(8),
            avgCost: averageCost.toFixed(6),
          },
          update: {
            quantity: newQuantity.toFixed(8),
            avgCost: averageCost.toFixed(6),
          },
        });
      } else {
        const newQuantity = previousQuantity.sub(quantity);
        await transaction.bankAccount.update({
          where: { userId: identity.userId },
          data: { cashBalance: { increment: total.toFixed(2) } },
        });
        if (newQuantity.lte(0)) {
          await transaction.holding.delete({ where: holdingKey });
        } else {
          await transaction.holding.update({ where: holdingKey, data: { quantity: newQuantity.toFixed(8) } });
        }
      }

      await transaction.investmentTrade.create({
        data: {
          orderId: created.orderId,
          userId: identity.userId,
          symbol,
          assetType: assetTypes[product.type],
          side: side === "buy" ? "BUY" : "SELL",
          quantity: quantity.toNumber(),
          unitPrice: price.toDecimalPlaces(2).toFixed(2),
          totalAmount: total.toFixed(2),
          tradedAt: created.createdAt,
        },
      });

      return created;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(orderResponse(order), { status: 201, headers: apiSuccessHeaders() });
  } catch (error) {
    if (error instanceof InsufficientFundsError) return apiError(400, "INSUFFICIENT_FUNDS", "Cash balance is lower than the order cost.");
    if (error instanceof InsufficientHoldingsError) {
      return apiError(400, "INSUFFICIENT_HOLDINGS", `Sell quantity exceeds holdings under this accountRef; current quantity is ${error.availableQuantity}.`);
    }
    if (error instanceof MarketDataError) return apiError(502, "MARKET_DATA_UNAVAILABLE", "Unable to retrieve the current market price.");
    if (isPrismaErrorCode(error, "P2002")) {
      try {
        const existing = await prisma.bankOrder.findUnique({
          where: { userId_idempotencyKey: { userId: identity.userId, idempotencyKey } },
        });
        if (existing) return NextResponse.json(orderResponse(existing), { headers: apiSuccessHeaders() });
      } catch (lookupError) {
        console.error("Failed to retrieve idempotent order after a uniqueness conflict:", lookupError);
      }
    }
    console.error(`Failed to place order for ${identity.userId}:`, error);
    return apiError(500, "INTERNAL_ERROR", "Unable to place the order.");
  }
}

class InsufficientFundsError extends Error {}
class InsufficientHoldingsError extends Error {
  constructor(readonly availableQuantity: number) {
    super("Insufficient holdings");
  }
}

function isPrismaErrorCode(error: unknown, code: string): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
