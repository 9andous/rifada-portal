import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/client";
import { proxy } from "@/proxy";
import { auth } from "@/server/auth/auth";
import { createUserWithPassword } from "@/server/auth/users";
import { db, resetDatabase } from "../support/db";

const BASE = "http://localhost:3000";
const PASSWORD = "test-pass-2026";
let ipCounter = 0;

/** Each call gets its own client IP so Better Auth's per-IP rate limit does not leak between tests. */
function freshIp() {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

function post(path: string, body: unknown, ip = freshIp(), cookie?: string) {
  return auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE,
        "x-forwarded-for": ip,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function makeUser(username: string, role: Role, extra: Partial<Parameters<typeof createUserWithPassword>[1]> = {}) {
  return createUserWithPassword(db, { username, name: username, role, password: PASSWORD, mustChangePassword: false, ...extra });
}

async function signIn(username: string, password = PASSWORD) {
  return post("/sign-in/username", { username, password });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("username and password sign-in", () => {
  it("creates a session, records the login and updates lastLoginAt", async () => {
    const user = await makeUser("officer.one", "ASSOCIATION_OFFICER");
    const response = await signIn("officer.one");
    expect(response.status).toBe(200);
    expect(cookieFrom(response)).toContain("session_token");

    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { actorId: user.id, action: "auth.login" } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).not.toBeNull();
  });

  it("is case-insensitive on the username", async () => {
    await makeUser("officer.two", "ASSOCIATION_OFFICER");
    expect((await signIn("Officer.Two")).status).toBe(200);
  });

  it("rejects a wrong password without creating a session", async () => {
    await makeUser("officer.three", "ASSOCIATION_OFFICER");
    expect((await signIn("officer.three", "wrong-pass-2026")).status).toBe(401);
    expect(await db.session.count()).toBe(0);
  });

  it("refuses a session to a deactivated account", async () => {
    const user = await makeUser("inactive.user", "SUPERVISOR");
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    const response = await signIn("inactive.user");
    expect(response.ok).toBe(false);
    expect(await db.session.count()).toBe(0);
  });

  it("rate-limits repeated attempts from the same address", async () => {
    await makeUser("target.user", "SUPERVISOR");
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await post("/sign-in/username", { username: "target.user", password: "wrong-pass-2026" }, ip)).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("has no public sign-up or username enumeration endpoint", async () => {
    const signUp = await post("/sign-up/email", { email: "x@example.org", password: PASSWORD, name: "x" });
    expect(signUp.ok).toBe(false);
    expect(await db.user.count()).toBe(0);
    const available = await post("/is-username-available", { username: "anyone" });
    expect(available.status).toBe(404);
  });

  it("does not let a user change their own role through the API", async () => {
    await makeUser("officer.four", "ASSOCIATION_OFFICER");
    const cookie = cookieFrom(await signIn("officer.four"));
    const response = await post("/update-user", { role: "SUPER_ADMIN" }, freshIp(), cookie);
    expect(response.ok).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { username: "officer.four" } })).role).toBe("ASSOCIATION_OFFICER");
  });
});

describe("mock Nafath sign-in", () => {
  it("rejects a malformed national ID", async () => {
    const response = await post("/nafath-mock/start", { nationalId: "12345" });
    expect(response.status).toBe(400);
  });

  it("signs in the active account linked to the national ID, once per transaction", async () => {
    const user = await makeUser("nafath.user", "ASSOCIATION_OFFICER", { nationalId: "1000000009" });
    const ip = freshIp();
    const start = await post("/nafath-mock/start", { nationalId: "1000000009" }, ip);
    expect(start.status).toBe(200);
    const { transactionId, code } = (await start.json()) as { transactionId: string; code: string };
    expect(code).toMatch(/^\d{2}$/);

    const complete = await post("/nafath-mock/complete", { transactionId }, ip);
    expect(complete.status).toBe(200);
    expect(cookieFrom(complete)).toContain("session_token");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    const replay = await post("/nafath-mock/complete", { transactionId }, ip);
    expect(replay.status).toBe(400);
  });

  it("does not sign in when no account is linked", async () => {
    const ip = freshIp();
    const start = await post("/nafath-mock/start", { nationalId: "2000000000" }, ip);
    const { transactionId } = (await start.json()) as { transactionId: string };
    expect((await post("/nafath-mock/complete", { transactionId }, ip)).status).toBe(403);
    expect(await db.session.count()).toBe(0);
  });
});

describe("route protection (proxy)", () => {
  async function sessionCookie(username: string, role: Role, mustChangePassword = false) {
    await makeUser(username, role, { mustChangePassword });
    return cookieFrom(await signIn(username));
  }

  function visit(path: string, cookie?: string) {
    return proxy(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));
  }

  it("sends anonymous visitors of protected areas to login, keeping the destination", async () => {
    for (const path of ["/admin", "/manager", "/supervisor/x", "/association", "/dashboard", "/account/change-password"]) {
      const response = await visit(path);
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(path);
    }
  });

  it("leaves public pages alone", async () => {
    for (const path of ["/", "/forgot-password", "/reset-password"]) {
      expect((await visit(path)).headers.get("location")).toBeNull();
    }
  });

  it("answers 403 when a role opens another role's area", async () => {
    const cases: [Role, string, string[]][] = [
      ["ASSOCIATION_OFFICER", "officer", ["/admin", "/manager", "/supervisor"]],
      ["SUPERVISOR", "supervisor", ["/admin", "/manager", "/association"]],
      ["UNIT_MANAGER", "manager", ["/admin", "/supervisor", "/association"]],
      ["SUPER_ADMIN", "admin", ["/manager", "/supervisor", "/association"]],
    ];
    for (const [role, username, denied] of cases) {
      const cookie = await sessionCookie(`${username}.proxy`, role);
      for (const path of denied) {
        const response = await visit(`${path}/anything`, cookie);
        expect(response.status, `${role} -> ${path}`).toBe(403);
        expect(response.headers.get("x-middleware-rewrite")).toContain("/forbidden");
      }
    }
  });

  it("lets each role into its own area and routes /dashboard to it", async () => {
    const homes: [Role, string][] = [
      ["ASSOCIATION_OFFICER", "/association"],
      ["SUPERVISOR", "/supervisor"],
      ["UNIT_MANAGER", "/manager"],
      ["SUPER_ADMIN", "/admin"],
    ];
    for (const [role, home] of homes) {
      const cookie = await sessionCookie(`${role.toLowerCase()}.home`, role);
      const own = await visit(home, cookie);
      expect(own.status).toBe(200);
      expect(own.headers.get("x-middleware-rewrite")).toBeNull();
      const dashboard = await visit("/dashboard", cookie);
      expect(new URL(dashboard.headers.get("location")!).pathname).toBe(home);
    }
  });

  it("forces the first-login password change before anything else", async () => {
    const cookie = await sessionCookie("first.login", "UNIT_MANAGER", true);
    const response = await visit("/manager", cookie);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/account/change-password");
    const changePage = await visit("/account/change-password", cookie);
    expect(changePage.headers.get("location")).toBeNull();
  });

  it("drops the session of a user deactivated after signing in", async () => {
    const cookie = await sessionCookie("later.inactive", "SUPERVISOR");
    await db.user.update({ where: { username: "later.inactive" }, data: { isActive: false } });
    const response = await visit("/supervisor", cookie);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});
