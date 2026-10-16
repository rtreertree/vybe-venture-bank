import { createInvestmentTransaction } from "@/lib/investment-transactions";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createInvestmentTransaction(request, "BUY");
}
