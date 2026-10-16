import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import { getServerClock, setServerClock, type ServerClockState } from "@/lib/bank-clock";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function clockResponse(state: ServerClockState) {
  // Orders stamped after the server time exist when the clock is moved backwards; they stay in the account.
  const ordersAfterServerTime = await prisma.bankOrder.count({ where: { createdAt: { gt: state.serverTime } } });
  return {
    serverTime: state.serverTime.toISOString(),
    realTime: state.realTime.toISOString(),
    mode: state.mode,
    ordersAfterServerTime,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await clockResponse(await getServerClock()), { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to read the server clock:", error);
    return apiError(500, "INTERNAL_ERROR", "Unable to read the server clock. Apply pending migrations.");
  }
}

// Body: { serverTime: ISO string | null, frozen?: boolean }. null returns to the real clock.
export async function PUT(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input) || !("serverTime" in input)) {
    return apiError(400, "INVALID_REQUEST", "serverTime (an ISO 8601 timestamp, or null for the real clock) is required.");
  }
  const body = input as { serverTime: unknown; frozen?: unknown };
  let serverTime: Date | null = null;
  if (body.serverTime !== null) {
    serverTime = typeof body.serverTime === "string" ? new Date(body.serverTime) : new Date(Number.NaN);
    if (Number.isNaN(serverTime.getTime())) return apiError(400, "INVALID_REQUEST", "serverTime must be a valid ISO 8601 timestamp.");
    if (serverTime.getUTCFullYear() < 1990 || serverTime.getUTCFullYear() > 2100) {
      return apiError(400, "INVALID_REQUEST", "serverTime must be between 1990 and 2100.");
    }
  }
  if (body.frozen !== undefined && typeof body.frozen !== "boolean") {
    return apiError(400, "INVALID_REQUEST", "frozen must be a boolean.");
  }
  try {
    const state = await setServerClock(serverTime, body.frozen === true);
    return NextResponse.json(await clockResponse(state), { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to update the server clock:", error);
    return apiError(500, "INTERNAL_ERROR", "Unable to update the server clock.");
  }
}
