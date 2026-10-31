import { describe, expect, it } from "vitest";
import { addWorkingDays, riyadhDateString, workingDaysBetween } from "@/lib/working-days";
import { SUBMITTED_ONLY, scopeComments, scopeRequests, type Actor } from "@/server/authz/scope";

// 2026-10-25 is a Sunday. Riyadh is UTC+3.
const at = (iso: string) => new Date(iso);

describe("working days (Sunday to Thursday, Asia/Riyadh)", () => {
  it("never counts the submission day", () => {
    expect(addWorkingDays(at("2026-10-25T07:00:00Z"), 1).toISOString()).toBe("2026-10-26T20:59:59.999Z");
  });

  it("skips Friday and Saturday", () => {
    // Thursday 2026-10-29 + 1 working day = Sunday 2026-11-01.
    expect(riyadhDateString(addWorkingDays(at("2026-10-29T08:00:00Z"), 1))).toBe("2026-11-01");
    // Sunday + 7 = Tuesday of the following week.
    expect(riyadhDateString(addWorkingDays(at("2026-10-25T08:00:00Z"), 7))).toBe("2026-11-03");
  });

  it("counts a weekend submission from Sunday", () => {
    expect(riyadhDateString(addWorkingDays(at("2026-10-30T10:00:00Z"), 1))).toBe("2026-11-01");
    expect(riyadhDateString(addWorkingDays(at("2026-10-31T10:00:00Z"), 5))).toBe("2026-11-05");
  });

  it("uses the Riyadh calendar day, not UTC", () => {
    // 22:30 UTC on Thursday is already Friday 01:30 in Riyadh.
    expect(riyadhDateString(at("2026-10-29T22:30:00Z"))).toBe("2026-10-30");
    expect(riyadhDateString(addWorkingDays(at("2026-10-29T22:30:00Z"), 1))).toBe("2026-11-01");
  });

  it("refuses a non-positive count", () => {
    expect(() => addWorkingDays(new Date(), 0)).toThrow(RangeError);
  });

  it("measures working days between two instants", () => {
    expect(workingDaysBetween(at("2026-10-25T08:00:00Z"), at("2026-11-03T08:00:00Z"))).toBe(7);
    expect(workingDaysBetween(at("2026-10-29T08:00:00Z"), at("2026-10-31T08:00:00Z"))).toBe(0);
  });
});

describe("draft privacy in the query scopers (change 19)", () => {
  const base = { id: "u", associationId: null, trackIds: [] as string[] };
  const actors: Record<string, Actor> = {
    admin: { ...base, role: "SUPER_ADMIN" },
    manager: { ...base, role: "UNIT_MANAGER" },
    supervisor: { ...base, role: "SUPERVISOR", trackIds: ["p1"] },
  };

  it.each(Object.keys(actors))("%s only ever sees submitted requests", (name) => {
    expect(scopeRequests(actors[name])).toMatchObject(SUBMITTED_ONLY);
    expect(scopeComments(actors[name]).request).toMatchObject(SUBMITTED_ONLY);
  });

  it("the officer sees the association's drafts too", () => {
    const officer: Actor = { ...base, role: "ASSOCIATION_OFFICER", associationId: "a1" };
    expect(scopeRequests(officer)).toEqual({ associationId: "a1" });
    expect(scopeComments(officer)).toEqual({ request: { associationId: "a1" }, isInternal: false });
  });
});
