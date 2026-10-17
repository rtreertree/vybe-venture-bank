import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { Decimal } from "@prisma/client/runtime/client";

export { Decimal };

export const nextServer = { NextResponse: { json: (data, options) => Response.json(data, options) } };
export const clock = {
  getServerTime: async () => new Date("2026-10-17T18:00:00Z"),
  startOfUtcDay: (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
};

// Execute the production modules with explicit boundary doubles. Unknown
// imports and network calls fail, so these tests cannot reach a real database.
export function loadModule(relative, dependencies = {}, extraGlobals = {}) {
  const filename = fileURLToPath(new URL(`../${relative}`, import.meta.url));
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const imports = { "next/server": nextServer, "@/generated/prisma/client": { Prisma: { Decimal } }, ...dependencies };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    Date, Request, Response, Headers, URL, AbortSignal,
    console: { error() {} },
    fetch() { throw new Error("Unexpected external request"); },
    ...extraGlobals,
  }, { filename });
  return module.exports;
}

export function transactionRetry() {
  return loadModule("lib/transaction-retry.ts", {
    "node:timers/promises": { setTimeout: async () => {} },
  });
}

export function api(prisma) {
  return loadModule("lib/bank-api.ts", { "@/lib/prisma": { prisma } });
}

export const bankOrders = () => loadModule("lib/bank-orders.ts");

export class MarketDataError extends Error {}
