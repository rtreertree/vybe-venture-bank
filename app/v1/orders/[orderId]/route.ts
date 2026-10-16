import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders, userIdFromRequest } from "@/lib/bank-api";
import { orderResponse } from "@/lib/bank-orders";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;
  const { orderId } = await context.params;
  try {
    const order = await prisma.bankOrder.findFirst({ where: { orderId, userId: identity.userId } });
    if (!order) return apiError(404, "ORDER_NOT_FOUND", "Order does not exist for this user.");
    return NextResponse.json(orderResponse(order), { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error(`Failed to load order ${orderId} for ${identity.userId}:`, error);
    return apiError(500, "INTERNAL_ERROR", "Unable to load the order.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const identity = userIdFromRequest(request);
  if (identity.error) return identity.error;
  const { orderId } = await context.params;
  try {
    const updated = await prisma.bankOrder.updateMany({
      where: { orderId, userId: identity.userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 1) {
      const order = await prisma.bankOrder.findFirst({ where: { orderId, userId: identity.userId } });
      if (!order) return apiError(404, "ORDER_NOT_FOUND", "Order does not exist for this user.");
      return NextResponse.json(orderResponse(order), { headers: apiSuccessHeaders() });
    }
    const existing = await prisma.bankOrder.findFirst({ where: { orderId, userId: identity.userId } });
    if (!existing) return apiError(404, "ORDER_NOT_FOUND", "Order does not exist for this user.");
    return apiError(409, "ORDER_NOT_CANCELLABLE", "Only pending orders can be cancelled.");
  } catch (error) {
    console.error(`Failed to cancel order ${orderId} for ${identity.userId}:`, error);
    return apiError(500, "INTERNAL_ERROR", "Unable to cancel the order.");
  }
}
