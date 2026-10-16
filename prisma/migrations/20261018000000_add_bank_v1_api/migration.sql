ALTER TABLE "InvestmentTrade" ADD COLUMN "orderId" TEXT;
CREATE UNIQUE INDEX "InvestmentTrade_orderId_key" ON "InvestmentTrade"("orderId");

CREATE TYPE "ProductType" AS ENUM ('STOCK', 'FUND', 'BOND', 'CRYPTO');
CREATE TYPE "ProductRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "BankOrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "BankOrderStatus" AS ENUM ('PENDING', 'FILLED', 'REJECTED', 'CANCELLED');

CREATE TABLE "BankAccount" (
    "userId" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "cashBalance" DECIMAL(20,2) NOT NULL DEFAULT 50000,
    "openingCashBalance" DECIMAL(20,2) NOT NULL DEFAULT 50000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Product" (
    "symbol" VARCHAR(12) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "ProductType" NOT NULL,
    "area" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "risk" "ProductRisk" NOT NULL DEFAULT 'MEDIUM',
    "riskNote" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "issuer" VARCHAR(160) NOT NULL,
    "region" VARCHAR(80) NOT NULL,
    "dividendYieldPercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "size" DECIMAL(24,2),
    "inceptionDate" DATE,
    "topHoldings" JSONB,
    "currentPrice" DECIMAL(20,6),
    "prevClose" DECIMAL(20,6),
    "priceAsOf" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("symbol")
);

CREATE TABLE "PriceHistory" (
    "id" BIGSERIAL NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "interval" VARCHAR(8) NOT NULL DEFAULT '1d',
    "t" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(20,6) NOT NULL,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holding" (
    "userId" VARCHAR(120) NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    CONSTRAINT "Holding_pkey" PRIMARY KEY ("userId","symbol")
);

CREATE TABLE "BankOrder" (
    "orderId" TEXT NOT NULL,
    "userId" VARCHAR(120) NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "side" "BankOrderSide" NOT NULL,
    "status" "BankOrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DECIMAL(24,8) NOT NULL,
    "filledPrice" DECIMAL(20,6),
    "priceAsOf" TIMESTAMP(3),
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankOrder_pkey" PRIMARY KEY ("orderId")
);

CREATE UNIQUE INDEX "BankOrder_userId_idempotencyKey_key" ON "BankOrder"("userId","idempotencyKey");
CREATE INDEX "BankOrder_userId_createdAt_idx" ON "BankOrder"("userId","createdAt" DESC);
CREATE INDEX "BankOrder_userId_status_idx" ON "BankOrder"("userId","status");
CREATE UNIQUE INDEX "PriceHistory_symbol_interval_t_key" ON "PriceHistory"("symbol","interval","t");
CREATE INDEX "PriceHistory_symbol_t_idx" ON "PriceHistory"("symbol","t");
CREATE INDEX "Holding_symbol_idx" ON "Holding"("symbol");
CREATE INDEX "Product_area_idx" ON "Product"("area");
CREATE INDEX "Product_type_risk_idx" ON "Product"("type","risk");

ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_symbol_fkey"
    FOREIGN KEY ("symbol") REFERENCES "Product"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "BankAccount"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_symbol_fkey"
    FOREIGN KEY ("symbol") REFERENCES "Product"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankOrder" ADD CONSTRAINT "BankOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "BankAccount"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankOrder" ADD CONSTRAINT "BankOrder_symbol_fkey"
    FOREIGN KEY ("symbol") REFERENCES "Product"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
