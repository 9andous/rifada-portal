import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

// Live notification signals (D-111). Writers call `signalUsers` inside their transaction:
// Postgres delivers `pg_notify` only when the transaction commits, so a listener never reads
// rows that are not there yet, and the signal reaches every app instance. Each process keeps ONE
// listening connection (lazy, shared by all open streams) and fans the signal out per user.

const CHANNEL = "rifada_notifications";
const RECONNECT_MS = 5000;

export type SignalKind = "new" | "read";
type Payload = { u: string[]; k: SignalKind };

type Hub = { bus: EventEmitter; client: Client | null; connecting: Promise<void> | null; retry: NodeJS.Timeout | null };

// One hub per process, kept across hot reloads in development.
const g = globalThis as unknown as { rifadaRealtime?: Hub };
const hub: Hub = (g.rifadaRealtime ??= { bus: new EventEmitter().setMaxListeners(0), client: null, connecting: null, retry: null });

function connect(): Promise<void> {
  if (hub.client || hub.connecting) return hub.connecting ?? Promise.resolve();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  hub.connecting = (async () => {
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      client.on("notification", (msg) => {
        if (!msg.payload) return;
        try {
          const p = JSON.parse(msg.payload) as Payload;
          for (const userId of p.u) hub.bus.emit(userId, p.k);
        } catch {
          // A malformed payload is ignored; it cannot come from this app.
        }
      });
      const drop = () => {
        if (hub.client !== client) return;
        hub.client = null;
        client.removeAllListeners();
        client.end().catch(() => {});
        scheduleReconnect();
      };
      client.on("error", drop);
      client.on("end", drop);
      hub.client = client;
    } catch {
      client.end().catch(() => {});
      scheduleReconnect();
    } finally {
      hub.connecting = null;
    }
  })();
  return hub.connecting;
}

/** One delayed retry at a time, and only while someone is listening: never a tight loop. */
function scheduleReconnect() {
  if (hub.retry || hub.bus.eventNames().length === 0) return;
  hub.retry = setTimeout(() => {
    hub.retry = null;
    if (hub.bus.eventNames().length) void connect();
  }, RECONNECT_MS);
}

/** Subscribes to one user's signals; returns the unsubscribe function. */
export function subscribeUser(userId: string, onSignal: (kind: SignalKind) => void): () => void {
  hub.bus.on(userId, onSignal);
  void connect();
  return () => {
    hub.bus.off(userId, onSignal);
  };
}

/** Signals users that their notifications changed; delivered when the transaction commits. */
export async function signalUsers(client: Prisma.TransactionClient | typeof db, userIds: readonly string[], kind: SignalKind): Promise<void> {
  if (userIds.length === 0) return;
  const payload = JSON.stringify({ u: [...new Set(userIds)], k: kind } satisfies Payload);
  await client.$executeRaw`SELECT pg_notify(${CHANNEL}, ${payload})`;
}
