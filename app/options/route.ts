import { NextResponse } from "next/server";
import { getServerTime } from "@/lib/bank-clock";
import { pricedInvestmentOptions } from "@/lib/option-pricing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const now = await getServerTime();
    return NextResponse.json(
      { server_time: now.toISOString(), options: await pricedInvestmentOptions(now) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to load investment options:", error);
    return NextResponse.json(
      { error: "Unable to load investment options. Check the database connection and apply pending migrations." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
