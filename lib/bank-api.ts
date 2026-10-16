import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function userIdFromRequest(request: Request) {
  const userId = request.headers.get("X-User-Id")?.trim() ?? "";
  if (!userId) return { error: apiError(401, "MISSING_USER_ID", "The X-User-Id header is required.") };
  if (userId.length > 120) return { error: apiError(401, "MISSING_USER_ID", "X-User-Id must be no more than 120 characters.") };
  return { userId };
}

export async function ensureBankAccount(userId: string) {
  return prisma.bankAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function apiSuccessHeaders() {
  return { "Cache-Control": "no-store" };
}
