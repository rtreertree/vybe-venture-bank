CREATE TYPE "InvestmentAssetType" AS ENUM ('STOCK', 'ETF', 'MUTUAL_FUND', 'BOND', 'CRYPTO', 'OTHER');
CREATE TYPE "InvestmentSide" AS ENUM ('BUY', 'SELL');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "InvestmentTrade" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(120) NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "assetType" "InvestmentAssetType" NOT NULL,
    "side" "InvestmentSide" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DECIMAL(20,2) NOT NULL,
    "totalAmount" DECIMAL(20,2) NOT NULL,
    "tradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentTrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvestmentTrade_userId_tradedAt_idx" ON "InvestmentTrade"("userId", "tradedAt" DESC);
