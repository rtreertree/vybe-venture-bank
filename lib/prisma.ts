import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const requiredModelDelegates = ["bankAccount", "bankOrder", "holding", "priceBar", "product", "serverClock"] as const;
const cachedPrisma = globalForPrisma.prisma;
const cachedClientMatchesSchema = cachedPrisma !== undefined
  && requiredModelDelegates.every((delegate) => typeof Reflect.get(cachedPrisma, delegate) === "object");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to connect to Neon Postgres.");
}

export const prisma = cachedClientMatchesSchema
  ? cachedPrisma
  : new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
