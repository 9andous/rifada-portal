// Request statuses and the default lifecycle. Statuses are create-only (names and colours stay as the
// super admin edited them); transitions are created when missing, and the automatic flag is set
// once on rows seeded before it existed (D-059).

import { readFileSync } from "node:fs";
import type { PrismaClient, Role } from "../../src/generated/prisma/client";

type StatusSeed = {
  statuses: { key: string; name: string; colorToken: string; isTerminal: boolean; sortOrder: number }[];
  transitions: { from: string; to: string; roles: Role[]; automatic?: boolean }[];
};

export async function seedStatuses(db: Pick<PrismaClient, "requestStatus" | "statusTransition">) {
  const seed = JSON.parse(readFileSync(new URL("./statuses.json", import.meta.url), "utf8")) as StatusSeed;
  for (const s of seed.statuses) {
    await db.requestStatus.upsert({ where: { key: s.key }, create: { ...s, isSystem: true }, update: {} });
  }
  const ids = new Map((await db.requestStatus.findMany()).map((s) => [s.key, s.id]));
  for (const t of seed.transitions) {
    const fromStatusId = ids.get(t.from)!;
    const toStatusId = ids.get(t.to)!;
    const isAutomatic = t.automatic === true;
    await db.statusTransition.upsert({
      where: { fromStatusId_toStatusId: { fromStatusId, toStatusId } },
      create: { fromStatusId, toStatusId, allowedRoles: t.roles, isAutomatic },
      update: {},
    });
    // Rows seeded before the automatic flag existed (D-059): flag them once, only while they still
    // have no roles, so an admin's later edit is never overwritten.
    if (isAutomatic) {
      await db.statusTransition.updateMany({
        where: { fromStatusId, toStatusId, isAutomatic: false, allowedRoles: { isEmpty: true } },
        data: { isAutomatic: true },
      });
    }
  }
}
