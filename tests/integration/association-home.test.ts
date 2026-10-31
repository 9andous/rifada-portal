import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz/scope";
import { getAssociationHome } from "@/server/services/association-home";
import { listRequests, parseRequestListParams } from "@/server/services/requests/read";
import { db, resetDatabase } from "../support/db";

// The association officer's home and the tabs of «طلباتي» (D-102).

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-22T09:00:00Z");
const STATUS_KEYS = ["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED"];

async function fixtures() {
  const status = Object.fromEntries(
    await Promise.all(
      STATUS_KEYS.map(async (key, i) => {
        const s = await db.requestStatus.create({ data: { key, name: key, colorToken: "neutral", sortOrder: i, isSystem: true } });
        return [key, s.id] as const;
      }),
    ),
  );
  const [own, other] = await Promise.all([db.association.create({ data: { name: "جمعية أ" } }), db.association.create({ data: { name: "جمعية ب" } })]);
  const program = await db.program.create({ data: { number: 1, name: "برنامج الأول" } });
  const initiative = await db.initiative.create({ data: { programId: program.id, number: 1, name: "مبادرة" } });
  const [officer, otherOfficer, supervisor] = await Promise.all([
    db.user.create({ data: { username: "off", name: "مسؤول", email: "off@x.invalid", role: "ASSOCIATION_OFFICER", associationId: own.id } }),
    db.user.create({ data: { username: "off2", name: "مسؤول آخر", email: "off2@x.invalid", role: "ASSOCIATION_OFFICER", associationId: other.id } }),
    db.user.create({ data: { username: "sup", name: "مشرف", email: "sup@x.invalid", role: "SUPERVISOR" } }),
  ]);

  let seq = 0;
  const request = async (associationId: string, createdById: string, key: string, title: string, minutesAgo: number) => {
    seq += 1;
    const submitted = key !== "DRAFT";
    return db.request.create({
      data: {
        associationId,
        programId: program.id,
        initiativeId: initiative.id,
        statusId: status[key],
        createdById,
        title,
        referenceNo: submitted ? `RF-1448-${String(seq).padStart(5, "0")}` : null,
        submittedAt: submitted ? new Date(NOW.getTime() - 2 * DAY) : null,
        updatedAt: new Date(NOW.getTime() - minutesAgo * 60000),
      },
    });
  };

  const returned = await request(own.id, officer.id, "RETURNED", "معاد", 50);
  await db.requestStatusHistory.createMany({
    data: [
      { requestId: returned.id, toStatusId: status.RETURNED, fromStatusId: status.UNDER_REVIEW, note: "ملاحظة قديمة", createdAt: new Date(NOW.getTime() - 3 * DAY), actorId: supervisor.id },
      { requestId: returned.id, toStatusId: status.RETURNED, fromStatusId: status.UNDER_REVIEW, note: "أرفقوا السير الذاتية", createdAt: new Date(NOW.getTime() - DAY), actorId: supervisor.id },
    ],
  });
  await request(own.id, officer.id, "DRAFT", "مسودة", 40);
  await request(own.id, officer.id, "UNDER_REVIEW", "قيد المراجعة", 30);
  await request(own.id, officer.id, "APPROVED", "معتمد", 20);
  await request(own.id, officer.id, "REJECTED", "مرفوض", 10);
  await request(other.id, otherOfficer.id, "RETURNED", "طلب جمعية أخرى", 5);

  const actor: Actor = { id: officer.id, role: "ASSOCIATION_OFFICER", associationId: own.id, trackIds: [] };
  return { actor };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("association home", () => {
  it("lists what waits on the association, with the supervisor's latest note and its date", async () => {
    const { actor } = await fixtures();
    const home = await getAssociationHome(actor, NOW);
    expect(home.returned.map((r) => [r.title, r.note])).toEqual([["معاد", "أرفقوا السير الذاتية"]]);
    expect(home.returned[0].returnedAt?.toISOString()).toBe(new Date(NOW.getTime() - DAY).toISOString());
    expect(home.drafts.map((r) => r.title)).toEqual(["مسودة"]);
    expect(home.latest).toHaveLength(5);
  });

  it("never shows another association's requests", async () => {
    const { actor } = await fixtures();
    const home = await getAssociationHome(actor, NOW);
    const titles = [...home.returned, ...home.drafts, ...home.latest].map((r) => r.title);
    expect(titles).not.toContain("طلب جمعية أخرى");
  });
});

describe("«طلباتي» by status", () => {
  it("filters the officer's own requests by the official status", async () => {
    const { actor } = await fixtures();
    const titles = async (status?: string) =>
      (await listRequests(actor, parseRequestListParams({ status, sort: "title", dir: "asc" }, "mine"), "mine", NOW)).items.map((r) => r.title).sort();
    expect(await titles("RETURNED")).toEqual(["معاد"]);
    expect(await titles("DRAFT")).toEqual(["مسودة"]);
    expect(await titles()).toHaveLength(5);
  });
});
