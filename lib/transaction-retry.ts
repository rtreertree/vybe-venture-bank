import { setTimeout as delay } from "node:timers/promises";

export function isPrismaErrorCode(error: unknown, code: string): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

// A serialization failure rolls back the whole transaction. Retry its reads and
// writes together so ownership and cash checks use the newly committed state.
export async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isPrismaErrorCode(error, "P2034") || attempt >= 3) throw error;
      await delay(10 * (2 ** attempt));
    }
  }
}
