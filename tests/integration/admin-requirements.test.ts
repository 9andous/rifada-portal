import { beforeEach, describe, expect, it } from "vitest";
import { fieldRequirementCreateSchema, fieldRequirementUpdateSchema } from "@/lib/validation/taxonomy";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  activeAttachmentTypes,
  createAttachmentType,
  listAttachmentTypes,
  parseAttachmentTypeListParams,
  setAttachmentTypeArchived,
  updateAttachmentType,
} from "@/server/services/admin/attachment-types";
import {
  copyRequirements,
  createAttachmentRequirement,
  createFieldRequirement,
  listRequirements,
  moveRequirement,
  previewCopy,
  removeRequirement,
  updateAttachmentRequirement,
  updateFieldRequirement,
} from "@/server/services/admin/requirements";
import { setInitiativeArchived } from "@/server/services/admin/taxonomy-editor";
import { makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { makeTaxonomy } from "../support/taxonomy";

let actors: Awaited<ReturnType<typeof makeRoleActors>>["actors"];
let admin: Actor;
let tax: Awaited<ReturnType<typeof makeTaxonomy>>;

const field = (overrides: Record<string, unknown> = {}) =>
  fieldRequirementCreateSchema.parse({ key: "trainees_count", label: "عدد المتدربين", fieldType: "NUMBER", options: [], isRequired: true, ...overrides });
const type = (key: string) => tax.types.find((t) => t.key === key)!;

beforeEach(async () => {
  await resetDatabase();
  tax = await makeTaxonomy();
  ({ actors } = await makeRoleActors());
  admin = actors.SUPER_ADMIN;
});

describe("attachment types", () => {
  it("are seeded once with the five defaults (create-only)", async () => {
    expect(tax.types.map((t) => t.key)).toEqual(["execution_timeline", "program_plan", "request_letter", "supporting_documents", "trainer_cvs"]);
    expect(tax.types.every((t) => !t.allowedMimeGroups.includes("video"))).toBe(true);
  });

  it("keep keys unique and immutable; archive instead of delete; archived types are not offered", async () => {
    expect((await createAttachmentType(admin, { key: "venue_permit", name: "تصريح المكان", groups: ["pdf"] })).ok).toBe(true);
    expect(await createAttachmentType(admin, { key: "venue_permit", name: "آخر", groups: ["pdf"] })).toMatchObject({ ok: false, errors: { key: expect.any(String) } });

    const t = type("program_plan");
    await updateAttachmentType(admin, t.id, { name: "خطة تنفيذ البرنامج", groups: ["pdf"] });
    expect(await db.attachmentType.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ key: "program_plan", name: "خطة تنفيذ البرنامج", allowedMimeGroups: ["pdf"] });

    await setAttachmentTypeArchived(admin, t.id, true);
    expect((await activeAttachmentTypes(admin)).map((x) => x.key)).not.toContain("program_plan");
    expect((await listAttachmentTypes(admin, parseAttachmentTypeListParams({ status: "archived" }))).items.map((x) => x.key)).toEqual(["program_plan"]);
    expect(await db.attachmentType.count()).toBe(6);
    expect((await db.auditLog.findMany({ where: { entityType: "AttachmentType" }, orderBy: { createdAt: "asc" } })).map((e) => e.action)).toEqual([
      "attachment_type.created",
      "attachment_type.updated",
      "attachment_type.archived",
    ]);
  });
});

describe("requirements", () => {
  it("adds fields and attachments in order; duplicate keys and repeated attachment types are refused", async () => {
    const i = tax.initiatives[0];
    expect((await createFieldRequirement(admin, i.id, field())).ok).toBe(true);
    expect((await createFieldRequirement(admin, i.id, field({ key: "level", label: "المستوى", fieldType: "SELECT", options: ["مبتدئ", "متقدم"] }))).ok).toBe(true);
    expect(await createFieldRequirement(admin, i.id, field())).toMatchObject({ ok: false, errors: { key: expect.any(String) } });
    expect((await createAttachmentRequirement(admin, i.id, { attachmentTypeId: type("trainer_cvs").id, isRequired: true })).ok).toBe(true);
    expect(await createAttachmentRequirement(admin, i.id, { attachmentTypeId: type("trainer_cvs").id, isRequired: false })).toMatchObject({ ok: false });
    // An attachment key may not collide with a field key either (one key space per initiative).
    expect(await createFieldRequirement(admin, i.id, field({ key: "trainer_cvs" }))).toMatchObject({ ok: false, errors: { key: expect.any(String) } });

    const { fields, attachments } = await listRequirements(admin, i.id);
    expect(fields.map((f) => [f.key, f.sortOrder, f.options])).toEqual([
      ["trainees_count", 1, []],
      ["level", 2, ["مبتدئ", "متقدم"]],
    ]);
    expect(attachments.map((a) => [a.key, a.label, a.isRequired])).toEqual([["trainer_cvs", "السير الذاتية للمدربين والمعلمين", true]]);
  });

  it("refuses archived attachment types and edits on archived initiatives", async () => {
    const i = tax.initiatives[0];
    await setAttachmentTypeArchived(admin, type("request_letter").id, true);
    expect(await createAttachmentRequirement(admin, i.id, { attachmentTypeId: type("request_letter").id, isRequired: true })).toMatchObject({ ok: false });
    await setInitiativeArchived(admin, i.id, true);
    expect(await createFieldRequirement(admin, i.id, field())).toMatchObject({ ok: false, message: expect.stringContaining("مؤرشفة") });
  });

  it("never changes a key on update; label, type, options and required flag may change", async () => {
    const i = tax.initiatives[0];
    await createFieldRequirement(admin, i.id, field({ fieldType: "SELECT", options: ["أ", "ب"] }));
    const r = (await listRequirements(admin, i.id)).fields[0];
    const update = fieldRequirementUpdateSchema.parse({ key: "renamed", label: "عدد المشاركين", fieldType: "NUMBER", options: ["أ"], isRequired: false });
    expect((await updateFieldRequirement(admin, r.id, update)).ok).toBe(true);
    const after = (await listRequirements(admin, i.id)).fields[0];
    expect(after).toMatchObject({ key: "trainees_count", label: "عدد المشاركين", fieldType: "NUMBER", options: [], isRequired: false });
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "requirement.updated" } });
    expect(entry.before).toMatchObject({ key: "trainees_count", fieldType: "SELECT", options: ["أ", "ب"] });
    expect(entry.after).toMatchObject({ key: "trainees_count", fieldType: "NUMBER", options: [] });
  });

  it("reorders within the same kind and removes with audit", async () => {
    const i = tax.initiatives[0];
    for (const key of ["a_one", "b_two", "c_three"]) await createFieldRequirement(admin, i.id, field({ key, label: key.replace("_", " ") }));
    await createAttachmentRequirement(admin, i.id, { attachmentTypeId: type("program_plan").id, isRequired: true });
    const third = (await listRequirements(admin, i.id)).fields[2];
    await moveRequirement(admin, third.id, "up");
    expect((await listRequirements(admin, i.id)).fields.map((f) => f.key)).toEqual(["a_one", "c_three", "b_two"]);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "requirement.reordered" } })).after).toMatchObject({ order: ["a_one", "c_three", "b_two"] });

    const attachment = (await listRequirements(admin, i.id)).attachments[0];
    await updateAttachmentRequirement(admin, attachment.id, false);
    await removeRequirement(admin, attachment.id);
    expect((await listRequirements(admin, i.id)).attachments).toEqual([]);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "requirement.removed" } })).before).toMatchObject({ key: "program_plan", isRequired: false });
  });

  it("are written by the super admin only; every role can read them", async () => {
    const i = tax.initiatives[0];
    await createFieldRequirement(admin, i.id, field());
    const r = (await listRequirements(admin, i.id)).fields[0];
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const a = actors[role];
      expect((await listRequirements(a, i.id, false)).fields).toHaveLength(1);
      const calls: (() => Promise<unknown>)[] = [
        () => listRequirements(a, i.id),
        () => createFieldRequirement(a, i.id, field({ key: "other" })),
        () => updateFieldRequirement(a, r.id, fieldRequirementUpdateSchema.parse({ label: "x y", fieldType: "TEXT", options: [], isRequired: true })),
        () => createAttachmentRequirement(a, i.id, { attachmentTypeId: type("program_plan").id, isRequired: true }),
        () => updateAttachmentRequirement(a, r.id, false),
        () => removeRequirement(a, r.id),
        () => moveRequirement(a, r.id, "up"),
        () => previewCopy(a, i.id, { programId: tax.programs[1].id }),
        () => copyRequirements(a, i.id, { programId: tax.programs[1].id }),
        () => activeAttachmentTypes(a),
        () => createAttachmentType(a, { key: "x_y", name: "س", groups: ["pdf"] }),
        () => updateAttachmentType(a, type("program_plan").id, { name: "س", groups: ["pdf"] }),
        () => setAttachmentTypeArchived(a, type("program_plan").id, true),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.initiativeRequirement.count()).toBe(1);
  });
});

describe("copy requirements (replace all)", () => {
  async function setup() {
    const [source, , , target1, target2] = tax.initiatives; // 1-1 as source; 2-1 and 2-2 as targets
    await createFieldRequirement(admin, source.id, field());
    await createFieldRequirement(admin, source.id, field({ key: "level", label: "المستوى", fieldType: "SELECT", options: ["أ", "ب"] }));
    await createAttachmentRequirement(admin, source.id, { attachmentTypeId: type("program_plan").id, isRequired: true });
    // target1: one identical, one same key but different, one extra
    await createFieldRequirement(admin, target1.id, field());
    await createFieldRequirement(admin, target1.id, field({ key: "level", label: "المستوى", fieldType: "TEXT" }));
    await createAttachmentRequirement(admin, target1.id, { attachmentTypeId: type("trainer_cvs").id, isRequired: false });
    return { source, target1, target2 };
  }

  it("previews removed / overwritten / unchanged / added per target without writing", async () => {
    const { source, target1, target2 } = await setup();
    const auditBefore = await db.auditLog.count();
    const preview = await previewCopy(admin, source.id, { initiativeIds: [target1.id, target2.id, source.id] });
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.sourceCount).toBe(3);
    expect(preview.items.map((i) => [i.number, i.removed, i.overwritten, i.unchanged, i.added])).toEqual([
      [1, ["trainer_cvs"], ["level"], ["trainees_count"], ["program_plan"]],
      [2, [], [], [], ["trainees_count", "level", "program_plan"]],
    ]);
    expect(await db.auditLog.count()).toBe(auditBefore);
    expect((await listRequirements(admin, target1.id)).attachments.map((a) => a.key)).toEqual(["trainer_cvs"]);
  });

  it("replaces every target's requirements with the source's, one audit entry per target", async () => {
    const { source, target1, target2 } = await setup();
    const result = await copyRequirements(admin, source.id, { initiativeIds: [target1.id, target2.id] });
    expect(result).toEqual({ ok: true, targets: 2 });
    const sourceReqs = await listRequirements(admin, source.id);
    for (const t of [target1, target2]) {
      const reqs = await listRequirements(admin, t.id);
      const shape = (r: typeof reqs) => [...r.fields, ...r.attachments].map((x) => [x.kind, x.key, x.label, x.fieldType, x.options, x.attachmentType?.key ?? null, x.isRequired, x.sortOrder]);
      expect(shape(reqs)).toEqual(shape(sourceReqs));
    }
    const entries = await db.auditLog.findMany({ where: { action: "requirements.copied" }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => e.entityId).sort()).toEqual([target1.id, target2.id].sort());
    const t1 = entries.find((e) => e.entityId === target1.id)!;
    expect((t1.before as { requirements: { key: string }[] }).requirements.map((r) => r.key).sort()).toEqual(["level", "trainees_count", "trainer_cvs"]);
    expect(t1.after).toMatchObject({ sourceInitiativeId: source.id });
  });

  it("copies to a whole program, skipping archived initiatives and the source itself", async () => {
    const { source } = await setup();
    const p2 = tax.programs[1];
    const archived = tax.initiatives[6]; // 2-4
    await setInitiativeArchived(admin, archived.id, true);
    const sameProgram = await copyRequirements(admin, source.id, { programId: tax.programs[0].id });
    expect(sameProgram).toEqual({ ok: true, targets: 2 }); // 1-2 and 1-3, not 1-1 itself
    expect(await copyRequirements(admin, source.id, { programId: p2.id })).toEqual({ ok: true, targets: 3 });
    expect((await listRequirements(admin, archived.id)).fields).toEqual([]);
  });

  it("refuses an empty target set", async () => {
    const { source } = await setup();
    expect(await copyRequirements(admin, source.id, { initiativeIds: [source.id] })).toMatchObject({ ok: false });
  });
});
