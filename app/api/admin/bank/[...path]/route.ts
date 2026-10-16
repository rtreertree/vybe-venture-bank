import { NextResponse } from "next/server";
import { DELETE as deleteAccount, GET as getAccount } from "@/app/v1/account/route";
import { GET as getAreas } from "@/app/v1/areas/route";
import { GET as getOrders, POST as postOrder } from "@/app/v1/orders/route";
import { DELETE as deleteOrder, GET as getOrder } from "@/app/v1/orders/[orderId]/route";
import { GET as getPortfolio } from "@/app/v1/portfolio/route";
import { GET as getPortfolioHistory } from "@/app/v1/portfolio/history/route";
import { GET as getProducts } from "@/app/v1/products/route";
import { GET as getProduct } from "@/app/v1/products/[symbol]/route";
import { GET as getProductHistory } from "@/app/v1/products/[symbol]/history/route";

export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  return dispatch(request, context, "GET");
}

export async function POST(request: Request, context: Context) {
  return dispatch(request, context, "POST");
}

export async function DELETE(request: Request, context: Context) {
  return dispatch(request, context, "DELETE");
}

async function dispatch(request: Request, context: Context, method: string) {
  const path = (await context.params).path.map((part) => decodeURIComponent(part));
  if (path.length === 1 && path[0] === "account" && method === "GET") return getAccount(request);
  if (path.length === 1 && path[0] === "account" && method === "DELETE") return deleteAccount(request);
  if (path.length === 1 && path[0] === "portfolio" && method === "GET") return getPortfolio(request);
  if (path.length === 2 && path[0] === "portfolio" && path[1] === "history" && method === "GET") return getPortfolioHistory(request);
  if (path.length === 1 && path[0] === "products" && method === "GET") return getProducts(request);
  if (path.length === 1 && path[0] === "areas" && method === "GET") return getAreas();
  if (path.length === 1 && path[0] === "orders") {
    if (method === "GET") return getOrders(request);
    if (method === "POST") return postOrder(request);
  }
  if (path.length === 2 && path[0] === "orders") {
    const params = Promise.resolve({ orderId: path[1] });
    if (method === "GET") return getOrder(request, { params });
    if (method === "DELETE") return deleteOrder(request, { params });
  }
  if (path.length === 2 && path[0] === "products" && method === "GET") {
    return getProduct(request, { params: Promise.resolve({ symbol: path[1] }) });
  }
  if (path.length === 3 && path[0] === "products" && path[2] === "history" && method === "GET") {
    return getProductHistory(request, { params: Promise.resolve({ symbol: path[1] }) });
  }
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "No admin bank preview endpoint matches this path." } },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
