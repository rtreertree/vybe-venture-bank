import assert from "node:assert/strict";
import test from "node:test";
import { api, bankOrders, clock, loadModule, MarketDataError } from "./module-loader.mjs";

function historyHarness() {
  const orders = [
    { symbol: "AAPL", accountRef: "stocks", quantity: 10, side: "BUY", total: 1000, createdAt: new Date("2026-09-01T15:00:00Z") },
    { symbol: "BTC", accountRef: "crypto", quantity: 5, side: "BUY", total: 1000, createdAt: new Date("2026-09-01T15:00:00Z") },
  ];
  const snapshots = {
    AAPL: [{ t: new Date("2026-10-01T13:30:00Z"), v: 100 }, { t: new Date("2026-10-02T13:30:00Z"), v: 100 }],
    BTC: [{ t: new Date("2026-10-01T00:00:00Z"), v: 200 }, { t: new Date("2026-10-02T00:00:00Z"), v: 200 }],
  };
  const prisma = {
    bankAccount: { upsert: async () => ({ currency: "USD", openingCashBalance: 50000 }) },
    bankOrder: { findMany: async () => orders },
    product: { findMany: async ({ where }) => where.symbol.in.map((symbol) => ({ symbol })) },
  };
  const { GET } = loadModule("app/v1/portfolio/history/route.ts", {
    "@/lib/bank-api": api(prisma), "@/lib/bank-clock": clock, "@/lib/bank-orders": bankOrders(), "@/lib/prisma": { prisma },
    "@/lib/bank-market-data": {
      MarketDataError, isChartRange: () => true, downsamplePoints: (points) => points,
      summarizePoints: (points) => ({ start: points[0].v, end: points.at(-1).v, change: points.at(-1).v - points[0].v }),
      loadMarketSnapshot: async (product) => ({ currency: "USD", interval: "15m", points: snapshots[product.symbol] }),
    },
  });
  return { orders, snapshots, get: (query = "") => GET(new Request(`http://localhost/v1/portfolio/history?range=1M${query}`, { headers: { "X-User-Id": "test-user" } })) };
}

test("different market opening times cannot invent a portfolio gain from an unpriced holding", async () => {
  const harness = historyHarness();
  const response = await harness.get();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.points[0].t, "2026-10-01T13:30:00.000Z");
  assert.ok(result.points.every(({ v }) => v === 50000));
  assert.equal(result.summary.change, 0);
});

test("history filtered by accountRef starts at its own price boundary and excludes shared cash", async () => {
  const harness = historyHarness();
  const result = await (await harness.get("&accountRef=crypto")).json();
  assert.equal(result.points[0].t, "2026-10-01T00:00:00.000Z");
  assert.ok(result.points.every(({ v }) => v === 1000));
});

test("later-listed products preserve earlier complete valuations and order events within the range", async () => {
  const harness = historyHarness();
  harness.orders.splice(0, harness.orders.length,
    { symbol: "AAPL", accountRef: "stocks", quantity: 10, side: "BUY", total: 1000, createdAt: new Date("2026-08-01T15:00:00Z") },
    { symbol: "AAPL", accountRef: "stocks", quantity: 1, side: "SELL", total: 100, createdAt: new Date("2026-10-01T15:00:00Z") },
    { symbol: "BTC", accountRef: "crypto", quantity: 5, side: "BUY", total: 1000, createdAt: new Date("2026-10-03T15:00:00Z") },
  );
  harness.snapshots.AAPL = [1, 2, 3].map((day) => ({ t: new Date(`2026-10-0${day}T13:30:00Z`), v: 100 }));
  harness.snapshots.BTC = [2, 3].map((day) => ({ t: new Date(`2026-10-0${day}T00:00:00Z`), v: 200 }));
  const response = await harness.get();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.points[0].t, "2026-10-01T13:30:00.000Z");
  assert.ok(result.points.some(({ t }) => t === "2026-10-01T15:00:00.000Z"));
  assert.equal(result.points.at(-1).t, "2026-10-03T15:00:00.000Z");
  assert.ok(result.points.every(({ v }) => v === 50000));
  assert.equal(result.summary.change, 0);
});

test("trade events after the last quote are retained at their filled cash amounts", async () => {
  const harness = historyHarness();
  harness.orders.push({ symbol: "AAPL", accountRef: "stocks", quantity: 1, side: "SELL", total: 100, createdAt: new Date("2026-10-03T15:00:00Z") });
  const result = await (await harness.get()).json();
  assert.equal(result.points.at(-1).t, "2026-10-03T15:00:00.000Z");
  assert.equal(result.points.at(-1).v, 50000);
});

test("an empty required symbol series returns a pricing error instead of valuing it at zero", async () => {
  const harness = historyHarness();
  harness.snapshots.AAPL = [];
  const response = await harness.get();
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "MARKET_DATA_UNAVAILABLE");
});
