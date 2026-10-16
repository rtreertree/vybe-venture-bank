import { prisma } from "@/lib/prisma";

const CLOCK_ID = 1;

export type ServerClockState = {
  serverTime: Date;
  realTime: Date;
  // "live" follows the real clock, "running" ticks forward from a chosen time, "frozen" stays on a chosen time.
  mode: "live" | "running" | "frozen";
};

function resolve(row: { baseTime: Date; setAt: Date; frozen: boolean } | null, realTime: Date): ServerClockState {
  if (!row) return { serverTime: realTime, realTime, mode: "live" };
  if (row.frozen) return { serverTime: row.baseTime, realTime, mode: "frozen" };
  return {
    serverTime: new Date(row.baseTime.getTime() + (realTime.getTime() - row.setAt.getTime())),
    realTime,
    mode: "running",
  };
}

export async function getServerClock(): Promise<ServerClockState> {
  const row = await prisma.serverClock.findUnique({ where: { id: CLOCK_ID } });
  return resolve(row, new Date());
}

// The bank's "now": every order, quote, and valuation is evaluated at this instant.
export async function getServerTime() {
  return (await getServerClock()).serverTime;
}

// serverTime null returns the bank to the real clock.
export async function setServerClock(serverTime: Date | null, frozen: boolean) {
  if (serverTime === null) {
    await prisma.serverClock.deleteMany({ where: { id: CLOCK_ID } });
    return getServerClock();
  }
  const setAt = new Date();
  await prisma.serverClock.upsert({
    where: { id: CLOCK_ID },
    create: { id: CLOCK_ID, baseTime: serverTime, setAt, frozen },
    update: { baseTime: serverTime, setAt, frozen },
  });
  return getServerClock();
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
