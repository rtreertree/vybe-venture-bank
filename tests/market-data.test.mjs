import assert from "node:assert/strict";
import test from "node:test";
import { api, clock, loadModule, MarketDataError } from "./module-loader.mjs";

const apple = { symbol: "AAPL", name: "Apple", type: "STOCK", area: "Technology", risk: "MEDIUM", description: "Apple" };
const quote = { currentPrice: 100, previousClose: 99, currency: "USD", name: "Apple", asOf: new Date("2026-10-16T13:30:00Z") };
const searchFetch = async () => Response.json({ quotes: [{ symbol: "NEW", shortname: "New product", quoteType: "EQUITY", exchDisp: "NYSE" }] });

test("failed product validation does not open a publishing transaction or create a catalog row", async () => {
  let transactions = 0;
  const prisma = { product: { findUnique: async () => null }, $transaction: async () => { transactions += 1; } };
  const { addYahooProduct } = loadModule("lib/yahoo-product-search.ts", {
    "@/lib/prisma": { prisma }, "@/lib/bank-clock": clock,
    "@/lib/bank-market-data": { MarketDataError, downloadMarketSnapshot: async () => { throw new MarketDataError("No prices as of server time"); } },
  }, { fetch: searchFetch });
  await assert.rejects(addYahooProduct("NEW"), /No prices as of server time/);
  assert.equal(transactions, 0);
});

test("snapshot storage failure rolls back its new product and successful imports publish both", async () => {
  for (const storageFails of [true, false]) {
    const rows = [];
    let stored = false;
    const prisma = {
      product: { findUnique: async () => null },
      async $transaction(operation, options) {
        assert.equal(options.timeout, 30000);
        const draft = [...rows];
        const transaction = { product: { upsert: async ({ create }) => { draft.push(create); return create; } } };
        const result = await operation(transaction);
        rows.push(...draft);
        return result;
      },
    };
    const { addYahooProduct } = loadModule("lib/yahoo-product-search.ts", {
      "@/lib/prisma": { prisma }, "@/lib/bank-clock": clock,
      "@/lib/bank-market-data": {
        MarketDataError,
        downloadMarketSnapshot: async () => ({ quote: { ...quote, name: "New product", currency: "EUR" }, dailySyncedAt: new Date(), intradaySyncedAt: null }),
        storeDownloadedSnapshot: async (transaction, symbol) => {
          assert.ok(transaction.product);
          assert.equal(symbol, "NEW");
          if (storageFails) throw new Error("Storage unavailable");
          stored = true;
        },
      },
    }, { fetch: searchFetch });
    if (storageFails) {
      await assert.rejects(addYahooProduct("NEW"), /Storage unavailable/);
      assert.equal(rows.length, 0);
    } else {
      const product = await addYahooProduct("NEW");
      assert.equal(product.currency, "EUR");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].currency, "EUR");
      assert.ok(stored);
    }
  }
});

test("catalog lists usable products and identifies poisoned or historically unavailable symbols", async () => {
  const products = [apple, { ...apple, symbol: "NEW" }];
  const prisma = { product: { count: async () => products.length, findMany: async () => products } };
  const { GET } = loadModule("app/v1/products/route.ts", {
    "@/lib/bank-api": api(prisma), "@/lib/bank-clock": clock, "@/lib/prisma": { prisma },
    "@/lib/bank-market-data": {
      MarketDataError, percentReturn: () => 0,
      loadMarketQuote: async (product) => { if (product.symbol === "NEW") throw new MarketDataError("No history"); return quote; },
    },
  });
  const response = await GET(new Request("http://localhost/v1/products"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.products.map(({ symbol }) => symbol), ["AAPL"]);
  assert.deepEqual(result.unavailableSymbols, ["NEW"]);
});

test("catalog does not hide database or programming errors as missing market data", async () => {
  const prisma = { product: { count: async () => 1, findMany: async () => [apple] } };
  const { GET } = loadModule("app/v1/products/route.ts", {
    "@/lib/bank-api": api(prisma), "@/lib/bank-clock": clock, "@/lib/prisma": { prisma },
    "@/lib/bank-market-data": { MarketDataError, loadMarketQuote: async () => { throw new Error("Database unavailable"); } },
  });
  const response = await GET(new Request("http://localhost/v1/products"));
  assert.equal(response.status, 500);
});

function downloader(fetch) {
  return loadModule("lib/bank-market-data.ts", {
    "@/lib/bank-clock": clock,
    "@/lib/prisma": { prisma: new Proxy({}, { get() { throw new Error("Download must not access the database"); } }) },
    "@/lib/bank-products": { toYahooSymbol: (symbol) => symbol },
  }, { fetch });
}

function chart(points, currency = "USD") {
  return Response.json({ chart: { result: [{ meta: { currency, longName: "New product" }, timestamp: points.map(({ t }) => Date.parse(t) / 1000), indicators: { quote: [{ close: points.map(({ v }) => v) }] } }] } });
}

test("import validation rejects data entirely after the selected server time without database access", async () => {
  const { downloadMarketSnapshot } = downloader(async () => chart([{ t: "2026-10-16T13:30:00Z", v: 100 }]));
  await assert.rejects(downloadMarketSnapshot({ symbol: "NEW", name: "New product", currency: "USD" }, new Date("2020-01-01T00:00:00Z")), /no price data as of/);
});

test("import can use completed daily data when intraday download is unavailable", async () => {
  const { downloadMarketSnapshot } = downloader(async (url) => new URL(url).searchParams.get("range") === "60d"
    ? new Response("Unavailable", { status: 503 })
    : chart([{ t: "2026-10-15T13:30:00Z", v: 99 }, { t: "2026-10-16T13:30:00Z", v: 100 }], "EUR"));
  const snapshot = await downloadMarketSnapshot({ symbol: "NEW", name: "New product", currency: "USD" }, new Date("2026-10-17T18:00:00Z"));
  assert.equal(snapshot.quote.currency, "EUR");
  assert.equal(snapshot.quote.currentPrice, 100);
  assert.equal(snapshot.quote.previousClose, 99);
  assert.equal(snapshot.intradaySyncedAt, null);
  assert.equal(snapshot.intraday.length, 0);
});

test("import validation rejects positive prices that become zero at persisted precision", async () => {
  const { downloadMarketSnapshot } = downloader(async () => chart([{ t: "2026-10-16T13:30:00Z", v: 0.0000001 }]));
  await assert.rejects(downloadMarketSnapshot({ symbol: "NEW", name: "New product", currency: "USD" }, new Date("2026-10-17T18:00:00Z")), /returned no 1d prices/);
});
