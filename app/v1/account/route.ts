import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders, ensureBankAccount, userIdFromRequest } from "@/lib/bank-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;

  try {
    const account = await ensureBankAccount(identity.userId);
    return NextResponse.json({
      userId: account.userId,
      currency: account.currency,
      cashBalance: Number(account.cashBalance),
      asOf: account.updatedAt.toISOString(),
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to load bank account:", error);
    return apiError(500, "INTERNAL_ERROR", "Unable to load the account.");
  }
}

// Prototype reset: removes the caller's account, holdings, orders and the trades those orders created.
export async function DELETE(request: Request) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;

  try {
    await prisma.$transaction([
      prisma.investmentTrade.deleteMany({ where: { userId: identity.userId, orderId: { not: null } } }),
      prisma.bankOrder.deleteMany({ where: { userId: identity.userId } }),
      prisma.holding.deleteMany({ where: { userId: identity.userId } }),
      prisma.bankAccount.deleteMany({ where: { userId: identity.userId } }),
    ]);
    return new Response(null, { status: 204, headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to delete bank account:", error);
    return apiError(500, "INTERNAL_ERROR", "Unable to delete the account.");
  }
}
