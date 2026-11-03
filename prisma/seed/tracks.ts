// The five tracks of technical supervision and their proposed programme links (D-119). Create-only
// and idempotent: a track number that already exists is left exactly as the super admin edited it,
// links included; links are only written when the track is created.

import { readFileSync } from "node:fs";
import type { PrismaClient } from "../../src/generated/prisma/client";

type TrackSeed = { tracks: { number: number; name: string; description: string; programs: number[] }[] };

export async function seedTracks(db: Pick<PrismaClient, "track" | "program">): Promise<{ created: number }> {
  const seed = JSON.parse(readFileSync(new URL("./tracks.json", import.meta.url), "utf8")) as TrackSeed;
  let created = 0;
  for (const t of seed.tracks) {
    if (await db.track.findUnique({ where: { number: t.number }, select: { id: true } })) continue;
    const programs = await db.program.findMany({ where: { number: { in: t.programs } }, select: { id: true } });
    await db.track.create({
      data: { number: t.number, name: t.name, description: t.description, sortOrder: t.number, programs: { create: programs.map((p) => ({ programId: p.id })) } },
    });
    created += 1;
  }
  return { created };
}
