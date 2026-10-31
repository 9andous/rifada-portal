import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, scopeFor, type Action } from "@/server/authz/permissions";
import { AREA_ROLES, ROLE_HOME, ROLES, areaForPath } from "@/server/authz/roles";
import { scopeAssociations, scopeComments, scopeRequests, type Actor } from "@/server/authz/scope";

const actor = (role: Actor["role"], extra: Partial<Actor> = {}): Actor => ({
  id: "u1",
  role,
  associationId: null,
  trackIds: [],
  ...extra,
});

describe("permission matrix", () => {
  it("gives every role its own home area, reachable only by that role", () => {
    for (const role of ROLES) {
      const area = areaForPath(ROLE_HOME[role]);
      expect(area).not.toBeNull();
      expect(AREA_ROLES[area!]).toEqual([role]);
    }
  });

  it("maps nested paths to their area", () => {
    expect(areaForPath("/admin/users/1")).toBe("/admin");
    expect(areaForPath("/administrator")).toBeNull();
    expect(areaForPath("/login")).toBeNull();
  });

  it("only association officers create and edit requests, and only their own", () => {
    for (const role of ROLES) {
      const expected = role === "ASSOCIATION_OFFICER" ? "own" : null;
      expect(scopeFor(role, "requests.create")).toBe(expected);
      expect(scopeFor(role, "requests.editDraft")).toBe(expected);
    }
  });

  it("never lets association officers read or write internal notes", () => {
    expect(can("ASSOCIATION_OFFICER", "comments.readInternal")).toBe(false);
    expect(can("ASSOCIATION_OFFICER", "comments.writeInternal")).toBe(false);
  });

  it("limits supervisors to their tracks for every scoped action they hold", () => {
    for (const action of Object.keys(PERMISSIONS) as Action[]) {
      const scope = scopeFor("SUPERVISOR", action);
      // Reference data shared with everyone (the taxonomy, published templates) is not track-scoped.
      expect(scope === null || scope === "tracks" || action === "taxonomy.read" || action === "templates.read").toBe(true);
    }
  });

  it("reserves administration to the super admin", () => {
    const adminOnly = ["admin.access", "users.manage", "associations.manage", "settings.manage", "audit.read"] as const;
    for (const action of adminOnly) {
      for (const role of ROLES) expect(can(role, action)).toBe(role === "SUPER_ADMIN");
    }
  });

  it("lets only the unit manager reassign requests", () => {
    for (const role of ROLES) expect(can(role, "requests.assign")).toBe(role === "UNIT_MANAGER");
  });
});

describe("query scopers", () => {
  it("scopes requests per role", () => {
    expect(scopeRequests(actor("UNIT_MANAGER"))).toEqual({ referenceNo: { not: null } });
    expect(scopeRequests(actor("SUPER_ADMIN"))).toEqual({ referenceNo: { not: null } });
    expect(scopeRequests(actor("SUPERVISOR", { trackIds: ["p1", "p2"] }))).toEqual({
      referenceNo: { not: null },
      trackId: { in: ["p1", "p2"] },
    });
    expect(scopeRequests(actor("ASSOCIATION_OFFICER", { associationId: "a1" }))).toEqual({ associationId: "a1" });
  });

  it("matches nothing for an officer without an association or a supervisor without tracks", () => {
    expect(scopeRequests(actor("ASSOCIATION_OFFICER"))).toEqual({ id: { in: [] } });
    expect(scopeRequests(actor("SUPERVISOR"))).toEqual({ referenceNo: { not: null }, trackId: { in: [] } });
  });

  it("denies review scope to officers", () => {
    expect(scopeRequests(actor("ASSOCIATION_OFFICER", { associationId: "a1" }), "requests.review")).toEqual({
      id: { in: [] },
    });
  });

  it("removes internal comments for association officers only", () => {
    expect(scopeComments(actor("ASSOCIATION_OFFICER", { associationId: "a1" }))).toEqual({
      request: { associationId: "a1" },
      isInternal: false,
    });
    expect(scopeComments(actor("SUPERVISOR", { trackIds: ["p1"] }))).toEqual({
      request: { referenceNo: { not: null }, trackId: { in: ["p1"] } },
    });
    expect(scopeComments(actor("UNIT_MANAGER"))).toEqual({ request: { referenceNo: { not: null } } });
  });

  it("scopes associations per role", () => {
    expect(scopeAssociations(actor("ASSOCIATION_OFFICER", { associationId: "a1" }))).toEqual({ id: "a1" });
    expect(scopeAssociations(actor("SUPERVISOR", { trackIds: ["p1"] }))).toEqual({
      requests: { some: { referenceNo: { not: null }, trackId: { in: ["p1"] } } },
    });
  });
});
