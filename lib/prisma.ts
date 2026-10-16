import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const requiredModelDelegates = ["bankAccount", "bankOrder", "holding", "priceBar", "product", "serverClock"] as const;
const cachedPrisma = globalForPrisma.prisma;
const cachedClientMatchesSchema = cachedPrisma !== undefined
  && requiredModelDelegates.every((delegate) => typeof Reflect.get(cachedPrisma, delegate) === "object");

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set to connect to Neon Postgres.");
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });
}

function getClient(): PrismaClient {
  if (cachedClientMatchesSchema && cachedPrisma) {
    return cachedPrisma;
  }

  const client = createClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

let instance: PrismaClient | undefined;

// Created on first use so `next build` can import route modules without DATABASE_URL.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    instance ??= getClient();
    return Reflect.get(instance, property);
  },
});
