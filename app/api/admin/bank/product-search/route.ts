import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import { MarketDataError } from "@/lib/bank-market-data";
import { addYahooProduct, ProductNotFoundError, searchYahooProducts } from "@/lib/yahoo-product-search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return apiError(400, "INVALID_REQUEST", "Search query must be between 2 and 80 characters.");
  }
  try {
    const products = await searchYahooProducts(query);
    return NextResponse.json({ products }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to search Yahoo Finance products:", error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", "Yahoo Finance search is temporarily unavailable.")
      : apiError(500, "INTERNAL_ERROR", "Unable to search for investments.");
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }
  const symbol = input && typeof input === "object" && !Array.isArray(input)
    && "symbol" in input && typeof input.symbol === "string"
    ? input.symbol.trim().toUpperCase()
    : "";
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    return apiError(400, "INVALID_REQUEST", "A valid Yahoo Finance symbol is required.");
  }
  try {
    const product = await addYahooProduct(symbol);
    return NextResponse.json({ product }, { status: 201, headers: apiSuccessHeaders() });
  } catch (error) {
    if (error instanceof ProductNotFoundError) return apiError(404, "PRODUCT_NOT_FOUND", error.message);
    console.error(`Failed to add product ${symbol} to the mock catalog:`, error);
    return error instanceof MarketDataError
      ? apiError(502, "MARKET_DATA_UNAVAILABLE", `Could not load current market prices for ${symbol}.`)
      : apiError(500, "INTERNAL_ERROR", "Unable to add this investment to the catalog.");
  }
}
