-- CreateEnum
CREATE TYPE "PriceInterval" AS ENUM ('DAILY', 'INTRADAY');

-- AlterTable: live quote columns are replaced by the PriceBar snapshot
ALTER TABLE "Product" DROP COLUMN "currentPrice",
DROP COLUMN "prevClose",
DROP COLUMN "priceAsOf",
ADD COLUMN "dailySyncedAt" TIMESTAMP(3),
ADD COLUMN "intradaySyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PriceBar" (
    "symbol" VARCHAR(12) NOT NULL,
    "interval" "PriceInterval" NOT NULL,
    "t" TIMESTAMP(3) NOT NULL,
    "close" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "PriceBar_pkey" PRIMARY KEY ("symbol","interval","t")
);

-- CreateTable
CREATE TABLE "ServerClock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "baseTime" TIMESTAMP(3) NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerClock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PriceBar" ADD CONSTRAINT "PriceBar_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Product"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
