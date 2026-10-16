import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const groups = await prisma.product.groupBy({
      by: ["area"],
      _count: { _all: true },
      orderBy: { area: "asc" },
    });
    return NextResponse.json({
      areas: groups.map(({ area, _count }) => ({ area, count: _count._all })),
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to list product areas:", error);
    return apiError(500, "INTERNAL_ERROR", "Unable to load product areas.");
  }
}
