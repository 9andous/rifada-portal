// Default attachment types (Phase 2b). Create-only and idempotent: a key that already exists is left
// exactly as the super admin edited it.

import { readFileSync } from "node:fs";
import type { PrismaClient } from "../../src/generated/prisma/client";

type AttachmentTypeSeed = { attachmentTypes: { key: string; name: string; groups: string[] }[] };

export async function seedAttachmentTypes(db: Pick<PrismaClient, "attachmentType">): Promise<{ created: number }> {
  const seed = JSON.parse(readFileSync(new URL("./attachment-types.json", import.meta.url), "utf8")) as AttachmentTypeSeed;
  let created = 0;
  for (const t of seed.attachmentTypes) {
    const existing = await db.attachmentType.findUnique({ where: { key: t.key }, select: { id: true } });
    if (existing) continue;
    await db.attachmentType.create({ data: { key: t.key, name: t.name, allowedMimeGroups: t.groups } });
    created += 1;
  }
  return { created };
}
