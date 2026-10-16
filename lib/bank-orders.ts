import type { BankOrder } from "@/generated/prisma/client";

// Response shape of docs/bank-api-spec.md in the client app; accountRef is null when unassigned.
export function orderResponse(order: BankOrder) {
  const quantity = Number(order.quantity);
  return {
    orderId: order.orderId,
    symbol: order.symbol,
    side: order.side.toLowerCase(),
    status: order.status.toLowerCase(),
    accountRef: order.accountRef || null,
    quantity,
    filledPrice: order.filledPrice === null ? null : Number(order.filledPrice),
    filledQuantity: order.status === "FILLED" ? quantity : 0,
    total: Number(order.total),
    asOf: order.priceAsOf?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

// accountRef is optional; undefined means "not given", the empty string is stored for unassigned.
export function parseAccountRef(value: unknown): { ok: true; value: string | undefined } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, value: undefined };
  if (typeof value !== "string" || value.length > 128) return { ok: false };
  return { ok: true, value };
}
