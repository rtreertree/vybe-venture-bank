import { NextResponse } from "next/server";
import { apiError, apiSuccessHeaders } from "@/lib/bank-api";
import { getServerClock } from "@/lib/bank-clock";

export const runtime = "nodejs";

// The bank's current time. Client apps should use this instead of their own clock when displaying or comparing bank data.
export async function GET() {
  try {
    const clock = await getServerClock();
    return NextResponse.json({
      serverTime: clock.serverTime.toISOString(),
      mode: clock.mode,
    }, { headers: apiSuccessHeaders() });
  } catch (error) {
    console.error("Failed to read the server clock:", error);
    return apiError(500, "INTERNAL_ERROR", "Unable to read the server time.");
  }
}
