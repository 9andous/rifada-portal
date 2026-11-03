import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/authz/scope";
import { createTrack, listTracks, setTrackArchived, setTrackPrograms, updateTrack } from "@/server/services/admin/taxonomy-editor";
import { getByTrack } from "@/server/services/dashboard";
import { db, resetDatabase } from "../support/db";
import { makeRequestWorld, submittedRequest, type RequestWorld } from "../support/requests";

// «المسارات» (D-119, D-123): tracks above the programmes, edited by the super admin, read by the
// unit's staff and counted on the staff dashboards. Associations choose one per request.

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-tracks-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

let w: RequestWorld;
beforeEach(async () => {
  await resetDatabase();
  rmSync(storageRoot, { recursive: true, force: true });
  w = await makeRequestWorld();
});

const track = async (name: string) => {
  const r = await createTrack(w.actors.admin, { name, description: null });
  if (!r.ok) throw new Error(r.message);
  return r.id;
};

describe("tracks editor", () => {
  it("numbers new tracks in order, edits, links programmes (several tracks per programme) and archives; everything audited", async () => {
    const a = await track("الدعوة والإرشاد");
    const b = await track("خدمة الحجاج والمعتمرين");
    const numberOf = async (id: string) => (await db.track.findUniqueOrThrow({ where: { id } })).number;
    expect(await numberOf(b)).toBe((await numberOf(a)) + 1);
    expect(await updateTrack(w.actors.admin, a, { name: "الدعوة والإرشاد والتوعية", description: "وصف" })).toEqual({ ok: true });
    expect(await setTrackPrograms(w.actors.admin, a, [w.p1.id, w.p2.id])).toEqual({ ok: true });
    expect(await setTrackPrograms(w.actors.admin, b, [w.p1.id])).toEqual({ ok: true });
    expect(await setTrackPrograms(w.actors.admin, b, ["missing-program-id"])).toMatchObject({ ok: false, errors: { programIds: expect.any(String) } });

    const list = await listTracks(w.actors.admin);
    expect(list.tracks.filter((t) => t.id === a || t.id === b).map((t) => [t.name, t.programs.map((p) => p.id)])).toEqual([
      ["الدعوة والإرشاد والتوعية", [w.p1.id, w.p2.id]],
      ["خدمة الحجاج والمعتمرين", [w.p1.id]],
    ]);
    expect(list.unplaced.map((p) => p.id)).not.toContain(w.p1.id);
    expect(list.unplaced.map((p) => p.id)).not.toContain(w.p2.id);

    expect(await setTrackArchived(w.actors.admin, a, true)).toEqual({ ok: true });
    expect(await setTrackPrograms(w.actors.admin, a, [])).toMatchObject({ ok: false });
    const open = (await listTracks(w.actors.manager, false)).tracks.map((t) => t.id);
    expect(open).toContain(b);
    expect(open).not.toContain(a);
    const actions = (await db.auditLog.findMany({ where: { entityType: "Track" }, select: { action: true } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["track.created", "track.updated", "track.programs_changed", "track.archived"]));
  });

  it("only the super admin edits; staff read; association officers never see tracks", async () => {
    const id = await track("مسار");
    for (const role of ["manager", "supervisor", "officer"] as const) {
      const a = w.actors[role];
      await expect(createTrack(a, { name: "مسار آخر", description: null })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updateTrack(a, id, { name: "تغيير", description: null })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setTrackPrograms(a, id, [w.p1.id])).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setTrackArchived(a, id, true)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await listTracks(w.actors.supervisor, false)).tracks.map((t) => t.id)).toContain(id);
    await expect(listTracks(w.actors.officer, false)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getByTrack(w.actors.officer)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("«التوزيع على المسارات»", () => {
  it("counts submitted requests per track the association chose (D-123)", async () => {
    await submittedRequest(w); // track 1
    await submittedRequest(w); // track 1
    await submittedRequest(w, w.actors.officer, w.t2);

    const manager = await getByTrack(w.actors.manager);
    const count = (id: string) => manager.rows.find((r) => r.id === id);
    expect(count(w.t1.id)).toMatchObject({ count: 2, open: 2 });
    expect(count(w.t2.id)).toMatchObject({ count: 1, open: 1 });
    expect(manager).toMatchObject({ unclassified: 0, total: 3 });

    // The supervisor sees only the tracks they supervise.
    const supervisor = await getByTrack(w.actors.supervisorP2);
    expect(supervisor.rows.find((r) => r.id === w.t2.id)?.count).toBe(1);
    expect(supervisor.rows.find((r) => r.id === w.t1.id)?.count).toBe(0);
    expect(supervisor.total).toBe(1);

    // An archived track leaves the distribution; its requests count as unclassified.
    await setTrackArchived(w.actors.admin, w.t2.id, true);
    const after = await getByTrack(w.actors.manager);
    expect(after.rows.map((r) => r.id)).not.toContain(w.t2.id);
    expect(after.unclassified).toBe(1);
  });
});
