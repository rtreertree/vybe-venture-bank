import { NextResponse } from "next/server";
import { fetchYahooMonth } from "@/lib/yahoo-finance";

export const runtime = "nodejs";

const assetTypes = new Set(["STOCK", "ETF", "MUTUAL_FUND", "BOND", "CRYPTO", "OTHER"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol")?.trim().toUpperCase() ?? "";
  const assetType = params.get("assetType")?.trim().toUpperCase() ?? "";

  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "A valid asset symbol is required." }, { status: 400 });
  }
  if (!assetTypes.has(assetType)) {
    return NextResponse.json({ error: "A valid asset type is required." }, { status: 400 });
  }

  try {
    const history = await fetchYahooMonth(symbol, assetType);
    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error(`Failed to retrieve Yahoo Finance history for ${symbol}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to retrieve live price history." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
