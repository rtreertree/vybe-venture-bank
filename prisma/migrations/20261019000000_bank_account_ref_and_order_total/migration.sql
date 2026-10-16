-- Holdings and orders are tagged with the client's planning account (accountRef; '' = unassigned).
ALTER TABLE "Holding" ADD COLUMN "accountRef" VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE "Holding" DROP CONSTRAINT "Holding_pkey";
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_pkey" PRIMARY KEY ("userId","accountRef","symbol");

ALTER TABLE "BankOrder" ADD COLUMN "accountRef" VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE "BankOrder" ADD COLUMN "total" DECIMAL(20,2) NOT NULL DEFAULT 0;
UPDATE "BankOrder" SET "total" = ROUND("quantity" * "filledPrice", 2) WHERE "filledPrice" IS NOT NULL;

CREATE INDEX "BankOrder_userId_accountRef_createdAt_idx" ON "BankOrder"("userId","accountRef","createdAt" DESC);
