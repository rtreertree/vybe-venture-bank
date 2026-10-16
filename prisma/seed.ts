import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";
import { bankProducts } from "../lib/bank-products";

const demoUsers = [
  {
    id: "mock-user-alex-morgan",
    name: "Alex Morgan",
    email: "alex.morgan@example.test",
    trades: [
      { symbol: "AAPL", assetType: "STOCK", side: "BUY", quantity: 10, unitPrice: 182.5, tradedAt: "2026-06-02T14:30:00.000Z" },
      { symbol: "AAPL", assetType: "STOCK", side: "SELL", quantity: 3, unitPrice: 194.2, tradedAt: "2026-08-14T14:30:00.000Z" },
      { symbol: "VTI", assetType: "ETF", side: "BUY", quantity: 8, unitPrice: 248.75, tradedAt: "2026-06-10T14:30:00.000Z" },
      { symbol: "VTI", assetType: "ETF", side: "SELL", quantity: 2, unitPrice: 253.1, tradedAt: "2026-09-03T14:30:00.000Z" },
    ],
  },
  {
    id: "mock-user-jamie-chen",
    name: "Jamie Chen",
    email: "jamie.chen@example.test",
    trades: [
      { symbol: "MSFT", assetType: "STOCK", side: "BUY", quantity: 6, unitPrice: 421.3, tradedAt: "2026-05-20T14:30:00.000Z" },
      { symbol: "MSFT", assetType: "STOCK", side: "SELL", quantity: 2, unitPrice: 438.6, tradedAt: "2026-08-20T14:30:00.000Z" },
      { symbol: "QQQ", assetType: "ETF", side: "BUY", quantity: 5, unitPrice: 516.4, tradedAt: "2026-06-18T14:30:00.000Z" },
      { symbol: "QQQ", assetType: "ETF", side: "SELL", quantity: 1, unitPrice: 529.75, tradedAt: "2026-09-10T14:30:00.000Z" },
    ],
  },
  {
    id: "mock-user-taylor-lee",
    name: "Taylor Lee",
    email: "taylor.lee@example.test",
    trades: [
      { symbol: "NVDA", assetType: "STOCK", side: "BUY", quantity: 12, unitPrice: 144.8, tradedAt: "2026-05-28T14:30:00.000Z" },
      { symbol: "NVDA", assetType: "STOCK", side: "SELL", quantity: 4, unitPrice: 158.25, tradedAt: "2026-08-25T14:30:00.000Z" },
      { symbol: "VOO", assetType: "ETF", side: "BUY", quantity: 4, unitPrice: 562.1, tradedAt: "2026-06-24T14:30:00.000Z" },
      { symbol: "VOO", assetType: "ETF", side: "SELL", quantity: 1, unitPrice: 578.45, tradedAt: "2026-09-12T14:30:00.000Z" },
    ],
  },
  {
    id: "mock-user-sam-rivera",
    name: "Sam Rivera",
    email: "sam.rivera@example.test",
    trades: [
      { symbol: "AMZN", assetType: "STOCK", side: "BUY", quantity: 7, unitPrice: 214.35, tradedAt: "2026-06-05T14:30:00.000Z" },
      { symbol: "AMZN", assetType: "STOCK", side: "SELL", quantity: 2, unitPrice: 226.8, tradedAt: "2026-08-28T14:30:00.000Z" },
      { symbol: "SCHD", assetType: "ETF", side: "BUY", quantity: 15, unitPrice: 27.4, tradedAt: "2026-06-30T14:30:00.000Z" },
      { symbol: "SCHD", assetType: "ETF", side: "SELL", quantity: 5, unitPrice: 28.15, tradedAt: "2026-09-16T14:30:00.000Z" },
    ],
  },
  {
    id: "mock-user-casey-patel",
    name: "Casey Patel",
    email: "casey.patel@example.test",
    trades: [
      { symbol: "GOOGL", assetType: "STOCK", side: "BUY", quantity: 9, unitPrice: 176.2, tradedAt: "2026-06-12T14:30:00.000Z" },
      { symbol: "GOOGL", assetType: "STOCK", side: "SELL", quantity: 3, unitPrice: 183.9, tradedAt: "2026-09-01T14:30:00.000Z" },
      { symbol: "IVV", assetType: "ETF", side: "BUY", quantity: 3, unitPrice: 618.6, tradedAt: "2026-07-06T14:30:00.000Z" },
      { symbol: "IVV", assetType: "ETF", side: "SELL", quantity: 1, unitPrice: 632.25, tradedAt: "2026-09-18T14:30:00.000Z" },
    ],
  },
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set to seed the demo data.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });

  try {
    for (const product of bankProducts) {
      await prisma.product.upsert({
        where: { symbol: product.symbol },
        create: product,
        update: {
          name: product.name,
          type: product.type,
          area: product.area,
          description: product.description,
          risk: product.risk,
          riskNote: product.riskNote,
          issuer: product.issuer,
          region: product.region,
          dividendYieldPercent: product.dividendYieldPercent,
        },
      });
    }

    for (const user of demoUsers) {
      await prisma.user.upsert({
        where: { id: user.id },
        create: { id: user.id, name: user.name, email: user.email },
        update: { name: user.name, email: user.email },
      });
      await prisma.bankAccount.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      const positions = new Map<string, { quantity: number; cost: number }>();
      let cashBalance = 50_000;

      for (const trade of user.trades) {
        const id = `${user.id}-${trade.symbol.toLowerCase()}-${trade.side.toLowerCase()}-${trade.tradedAt.slice(0, 10)}`;
        const totalAmount = Number((trade.quantity * trade.unitPrice).toFixed(2));
        const tradedAt = new Date(trade.tradedAt);
        const data = {
          userId: user.id,
          symbol: trade.symbol,
          assetType: trade.assetType,
          side: trade.side,
          quantity: trade.quantity,
          unitPrice: trade.unitPrice,
          totalAmount,
          tradedAt,
        };

        await prisma.investmentTrade.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });

        const position = positions.get(trade.symbol) ?? { quantity: 0, cost: 0 };
        if (trade.side === "BUY") {
          position.cost += totalAmount;
          position.quantity += trade.quantity;
          cashBalance -= totalAmount;
        } else {
          const averageCost = position.quantity > 0 ? position.cost / position.quantity : 0;
          position.quantity -= trade.quantity;
          position.cost = Math.max(0, position.quantity) * averageCost;
          cashBalance += totalAmount;
        }
        positions.set(trade.symbol, position);

        const orderId = `seed-${id}`;
        const idempotencyKey = `demo-${trade.symbol.toLowerCase()}-${trade.side.toLowerCase()}-${trade.tradedAt.slice(0, 10)}`;
        await prisma.bankOrder.upsert({
          where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } },
          create: {
            orderId,
            userId: user.id,
            symbol: trade.symbol,
            side: trade.side,
            status: "FILLED",
            quantity: trade.quantity.toFixed(8),
            filledPrice: trade.unitPrice.toFixed(6),
            total: totalAmount.toFixed(2),
            priceAsOf: tradedAt,
            idempotencyKey,
            createdAt: tradedAt,
          },
          update: {
            side: trade.side,
            status: "FILLED",
            quantity: trade.quantity.toFixed(8),
            filledPrice: trade.unitPrice.toFixed(6),
            total: totalAmount.toFixed(2),
            priceAsOf: tradedAt,
            createdAt: tradedAt,
          },
        });
        await prisma.investmentTrade.update({
          where: { id },
          data: { orderId },
        });
      }

      await prisma.bankAccount.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          cashBalance: cashBalance.toFixed(2),
          openingCashBalance: "50000",
        },
        update: {
          cashBalance: cashBalance.toFixed(2),
          openingCashBalance: "50000",
        },
      });
      for (const [symbol, position] of positions) {
        if (position.quantity <= 0) continue;
        await prisma.holding.upsert({
          where: { userId_accountRef_symbol: { userId: user.id, accountRef: "", symbol } },
          create: {
            userId: user.id,
            symbol,
            quantity: position.quantity.toFixed(8),
            avgCost: (position.cost / position.quantity).toFixed(6),
          },
          update: {
            quantity: position.quantity.toFixed(8),
            avgCost: (position.cost / position.quantity).toFixed(6),
          },
        });
      }
    }

    console.info(`Seeded ${demoUsers.length} demo users with ${demoUsers.reduce((count, user) => count + user.trades.length, 0)} investment trades.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to seed demo investment data:", error);
  process.exitCode = 1;
});
