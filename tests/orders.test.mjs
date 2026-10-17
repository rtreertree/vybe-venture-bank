import assert from "node:assert/strict";
import test from "node:test";
import { api, bankOrders, clock, Decimal, loadModule, MarketDataError, transactionRetry } from "./module-loader.mjs";

function orderHarness({ price = 200, conflicts = 0 } = {}) {
  const state = { cash: "50000.00", holding: null, orders: [], trades: [] };
  let attempts = 0;
  const hydrate = (order) => order && ({ ...order, quantity: new Decimal(order.quantity), filledPrice: new Decimal(order.filledPrice), total: new Decimal(order.total) });
  const findOrder = (data, { where }) => hydrate(data.orders.find((order) => order.idempotencyKey === where.userId_idempotencyKey.idempotencyKey));
  const prisma = {
    bankAccount: { upsert: async () => ({ currency: "USD", cashBalance: new Decimal(state.cash) }) },
    bankOrder: { findUnique: async (query) => findOrder(state, query) },
    product: { findUnique: async () => ({ symbol: "AAPL", type: "STOCK" }) },
    async $transaction(operation, options) {
      attempts += 1;
      assert.equal(options.isolationLevel, "Serializable");
      const draft = structuredClone(state);
      const result = await operation({
        bankAccount: {
          findUnique: async () => ({ cashBalance: new Decimal(draft.cash) }),
          update: async ({ data }) => {
            const change = data.cashBalance;
            draft.cash = (change.decrement ? new Decimal(draft.cash).sub(change.decrement) : new Decimal(draft.cash).add(change.increment)).toFixed(2);
          },
        },
        bankOrder: {
          findUnique: async (query) => findOrder(draft, query),
          create: async ({ data }) => {
            const order = { orderId: `order-${draft.orders.length}`, updatedAt: new Date(), ...data };
            draft.orders.push(order);
            return hydrate(order);
          },
        },
        holding: {
          findUnique: async () => draft.holding,
          upsert: async ({ create, update }) => { draft.holding = draft.holding ? { ...draft.holding, ...update } : create; },
          update: async ({ data }) => { draft.holding = { ...draft.holding, ...data }; },
          delete: async () => { draft.holding = null; },
        },
        investmentTrade: { create: async ({ data }) => { draft.trades.push(data); } },
      });
      if (attempts <= conflicts) throw Object.assign(new Error("Serialization failure"), { code: "P2034" });
      Object.assign(state, draft);
      return result;
    },
  };
  const { POST } = loadModule("app/v1/orders/route.ts", {
    "@/lib/bank-api": api(prisma),
    "@/lib/bank-clock": clock,
    "@/lib/bank-market-data": { MarketDataError, loadMarketQuote: async () => ({ currentPrice: price, currency: "USD", asOf: new Date("2026-10-17T17:45:00Z") }) },
    "@/lib/bank-orders": bankOrders(),
    "@/lib/prisma": { prisma },
    "@/lib/transaction-retry": transactionRetry(),
  });
  let key = 0;
  return {
    state, prisma,
    attempts: () => attempts,
    place: (side, values, idempotencyKey = `regression-${key++}`) => POST(new Request("http://localhost/v1/orders", {
      method: "POST", headers: { "X-User-Id": "test-user" }, body: JSON.stringify({ symbol: "AAPL", side, idempotencyKey, ...values }),
    })),
  };
}

test("splitting trades cannot create cash, including positive-total and zero-cost exploits", async () => {
  for (const steps of [
    [["buy", 0.000024], ["buy", 0.000024], ["sell", 0.000048]],
    [["buy", 0.000051], ["sell", 0.000026], ["sell", 0.000025]],
  ]) {
    const harness = orderHarness();
    for (const [side, quantity] of steps) assert.equal((await harness.place(side, { quantity })).status, 201);
    assert.ok(new Decimal(harness.state.cash).lte(50000));
    assert.equal(harness.state.holding, null);
    assert.ok(harness.state.orders.filter(({ side }) => side === "BUY").every(({ total }) => new Decimal(total).gt(0)));
  }
});

test("buy basis includes the actual debit and a dust sell can close for zero proceeds", async () => {
  const harness = orderHarness();
  const buy = await harness.place("buy", { quantity: 0.000024 });
  assert.equal((await buy.json()).total, 0.01);
  assert.equal(harness.state.cash, "49999.99");
  assert.equal(harness.state.holding.avgCost, "416.666667");
  const sell = await harness.place("sell", { quantity: 0.000024 });
  assert.equal((await sell.json()).total, 0);
  assert.equal(harness.state.holding, null);
  assert.equal(harness.state.cash, "49999.99");
});

test("amount buys respect the cash budget after upward cent rounding", async () => {
  const harness = orderHarness();
  const response = await harness.place("buy", { amount: 0.0199 });
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.quantity, 0.00005);
  assert.equal(order.total, 0.01);
  assert.ok(order.total <= 0.0199);
});

test("serialization retries roll back drafts and commit one fill", async () => {
  const harness = orderHarness({ conflicts: 2 });
  assert.equal((await harness.place("buy", { quantity: 1 })).status, 201);
  assert.equal(harness.attempts(), 3);
  assert.equal(harness.state.orders.length, 1);
  assert.equal(harness.state.trades.length, 1);
  assert.equal(harness.state.holding.quantity, "1.00000000");
  assert.equal(harness.state.cash, "49800.00");
});

test("a concurrently committed idempotent order returns the original before funds checks", async () => {
  const harness = orderHarness();
  const first = await harness.place("buy", { quantity: 250 }, "same-request-key");
  const firstOrder = await first.json();
  assert.equal(harness.state.cash, "0.00");
  // The second request's preliminary lookup happened before the first committed.
  harness.prisma.bankOrder.findUnique = async () => null;
  const repeat = await harness.place("buy", { quantity: 250 }, "same-request-key");
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).orderId, firstOrder.orderId);
  assert.equal(harness.state.orders.length, 1);
  assert.equal(harness.state.cash, "0.00");
});

test("persistent serialization contention is bounded and returns a retryable error", async () => {
  const harness = orderHarness({ conflicts: 10 });
  const response = await harness.place("buy", { quantity: 1 });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "ACCOUNT_BUSY");
  assert.equal(harness.attempts(), 4);
  assert.equal(harness.state.orders.length, 0);
  assert.equal(harness.state.cash, "50000.00");
});
