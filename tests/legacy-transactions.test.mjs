import assert from "node:assert/strict";
import test from "node:test";
import { clock, loadModule, transactionRetry } from "./module-loader.mjs";

function legacyHarness(initialTrades) {
  let trades = structuredClone(initialTrades);
  let revision = 0;
  let attempts = 0;
  const prisma = {
    async $transaction(operation, options) {
      assert.equal(options.isolationLevel, "Serializable");
      attempts += 1;
      const readRevision = revision;
      const draft = structuredClone(trades);
      const result = await operation({ investmentTrade: {
        findMany: async () => structuredClone(draft),
        create: async ({ data }) => {
          const trade = { id: `legacy-${draft.length}`, ...data };
          draft.push(trade);
          return trade;
        },
      } });
      // Model a conflicting serializable snapshot without allowing its writes
      // to leak into the next attempt.
      if (readRevision !== revision) throw Object.assign(new Error("Serialization failure"), { code: "P2034" });
      trades = draft;
      revision += 1;
      return result;
    },
  };
  const { createInvestmentTransaction } = loadModule("lib/investment-transactions.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/bank-clock": clock,
    "@/lib/mock-investment-options": loadModule("lib/mock-investment-options.ts"),
    "@/lib/option-pricing": { pricesAtServerTime: async () => new Map([["AAPL", { price: 200 }]]) },
    "@/lib/transaction-retry": transactionRetry(),
  });
  return {
    trades: () => trades,
    attempts: () => attempts,
    sell: (quantity) => createInvestmentTransaction(new Request("http://localhost/transaction/sell", {
      method: "POST", body: JSON.stringify({ user_id: "test-user", option_id: "stock-aapl", quantity }),
    }), "SELL"),
  };
}

test("two concurrent sells of one owned unit commit only one sell", async () => {
  const harness = legacyHarness([{ side: "BUY", quantity: 1 }]);
  const responses = await Promise.all([harness.sell(1), harness.sell(1)]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 400]);
  assert.equal(harness.trades().length, 2);
  assert.equal(harness.attempts(), 3);
});

test("an absolute quantity tolerance cannot sell units that were never owned", async () => {
  const harness = legacyHarness([]);
  assert.equal((await harness.sell(0.000001)).status, 400);
  assert.equal(harness.trades().length, 0);
});

test("decimal ownership arithmetic permits an exact fractional close", async () => {
  const harness = legacyHarness([{ side: "BUY", quantity: 0.3 }, { side: "SELL", quantity: 0.1 }]);
  assert.equal((await harness.sell(0.2)).status, 201);
  assert.equal((await harness.sell(0.000001)).status, 400);
});
