// Phase 3 route handlers (upload, download) with real Better Auth sessions, and the request pages
// behind the proxy for every role.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as uploadRoute } from "@/app/api/requests/[id]/uploads/route";
import { GET as fileRoute } from "@/app/api/requests/[id]/files/[versionId]/route";
import { proxy } from "@/proxy";
import { auth } from "@/server/auth/auth";
import { addComment } from "@/server/services/requests/comments";
import { TEST_PASSWORD } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";
import { makeRequestWorld, MIME, newDraft, stageFor, submittedRequest, type RequestWorld } from "../support/requests";

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-requests-routes-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

const BASE = "http://localhost:3000";
let ip = 0;
let w: RequestWorld;

beforeEach(async () => {
  await resetDatabase();
  rmSync(storageRoot, { recursive: true, force: true });
  w = await makeRequestWorld();
});

async function cookieFor(username: string) {
  ip += 1;
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.70.0.${ip}` },
      body: JSON.stringify({ username, password: TEST_PASSWORD }),
    }),
  );
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

function upload(id: string, purpose: string, cookie: string | undefined, origin: string | null = BASE, body: Buffer = FIXTURES.pdf(), name = "خطة.pdf", mime = MIME.pdf) {
  const headers: Record<string, string> = { "content-type": mime, "x-file-name": encodeURIComponent(name), "content-length": String(body.length) };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  return uploadRoute(
    new NextRequest(`${BASE}/api/requests/${id}/uploads?purpose=${purpose}`, { method: "POST", headers, body: new Uint8Array(body), duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]),
    { params: Promise.resolve({ id }) },
  );
}

function download(id: string, versionId: string, cookie?: string) {
  return fileRoute(new NextRequest(`${BASE}/api/requests/${id}/files/${versionId}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ id, versionId }) });
}

const names = () => ({
  admin: w.users.admin.username!,
  manager: w.users.manager.username!,
  supervisor: w.users.supervisor.username!,
  supervisorP2: w.users.supervisorP2.username!,
  officer: w.users.officer.username!,
  officer2: w.users.officer2.username!,
});

describe("upload route", () => {
  it("stages request files only for the officer's own editable request, before reading the body", async () => {
    const draft = await newDraft(w);
    const n = names();
    const officer = await cookieFor(n.officer);
    const ok = await upload(draft, "request", officer);
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(Object.keys(body).sort()).toEqual(["fileName", "mime", "size", "uploadId"]);
    for (const who of ["officer2", "manager", "supervisor", "admin"] as const) {
      expect((await upload(draft, "request", await cookieFor(n[who]))).status, who).toBe(403);
      expect((await upload(draft, "comment", await cookieFor(n[who]))).status, who).toBe(403);
    }
    expect((await upload(draft, "request", undefined)).status).toBe(401);
    expect((await upload(draft, "request", officer, "https://evil.example")).status).toBe(403);
    expect((await upload(draft, "request", officer, null)).status).toBe(403);
    expect((await upload(draft, "other", officer)).status).toBe(400);
    expect((await upload(draft, "request", officer, BASE, FIXTURES.exe(), "plan.pdf")).status).toBe(415);
  });

  it("stages comment files for anyone who may comment on the submitted request", async () => {
    const { id } = await submittedRequest(w);
    const n = names();
    for (const who of ["officer", "manager", "supervisor"] as const) expect((await upload(id, "comment", await cookieFor(n[who]))).status, who).toBe(201);
    for (const who of ["officer2", "supervisorP2", "admin"] as const) expect((await upload(id, "comment", await cookieFor(n[who]))).status, who).toBe(403);
    expect((await upload(id, "request", await cookieFor(n.officer))).status).toBe(403); // under review: no edits
  });
});

describe("download route", () => {
  it("serves files as attachments to readers only, and hides internal-note files from officers", async () => {
    const { id } = await submittedRequest(w);
    const version = await db.attachmentVersion.findFirstOrThrow({ where: { attachment: { requestId: id } } });
    const n = names();
    for (const who of ["officer", "manager", "supervisor", "admin"] as const) {
      const res = await download(id, version.id, await cookieFor(n[who]));
      expect(res.status, who).toBe(200);
      expect(res.headers.get("content-disposition")).toMatch(/^attachment; /);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      await res.arrayBuffer();
    }
    for (const who of ["officer2", "supervisorP2"] as const) expect((await download(id, version.id, await cookieFor(n[who]))).status, who).toBe(404);
    expect((await download(id, version.id)).status).toBe(401);
    expect((await download("wrong-request-id", version.id, await cookieFor(n.manager))).status).toBe(404);

    const note = await addComment(w.actors.supervisor, id, { body: "ملاحظة", internal: true, uploadIds: [await stageFor(w.actors.supervisor, id, "داخلي.pdf", FIXTURES.pdf("internal"))] });
    expect(note.ok).toBe(true);
    const internal = await db.attachmentVersion.findFirstOrThrow({ where: { fileName: "داخلي.pdf" } });
    expect((await download(id, internal.id, await cookieFor(n.officer))).status).toBe(404);
    const staff = await download(id, internal.id, await cookieFor(n.manager));
    expect(staff.status).toBe(200);
    await staff.arrayBuffer();
  });

  it("never serves a draft's file to staff", async () => {
    const draft = await newDraft(w);
    const uploadId = await stageFor(w.actors.officer, draft);
    const { attachRequirementFile } = await import("@/server/services/requests/attachments");
    await attachRequirementFile(w.actors.officer, draft, "program_plan", uploadId);
    const version = await db.attachmentVersion.findFirstOrThrow({ where: { attachment: { requestId: draft } } });
    const n = names();
    for (const who of ["admin", "manager", "supervisor"] as const) expect((await download(draft, version.id, await cookieFor(n[who]))).status, who).toBe(404);
    const own = await download(draft, version.id, await cookieFor(n.officer));
    expect(own.status).toBe(200);
    await own.arrayBuffer();
  });
});

describe("request pages behind the proxy", () => {
  const page = async (path: string, cookie?: string) => proxy(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));
  const forbidden = (res: Response) => res.status === 403 && (res.headers.get("x-middleware-rewrite") ?? "").includes("/forbidden");

  it("open each role's own request area and refuse the others", async () => {
    const n = names();
    const areas = {
      officer: ["/association/requests", "/association/requests/new"],
      supervisor: ["/supervisor/queue", "/supervisor/requests"],
      manager: ["/manager/requests", "/manager/assignment"],
      admin: ["/admin/requests"],
    } as const;
    for (const [who, paths] of Object.entries(areas) as [keyof typeof areas, readonly string[]][]) {
      const cookie = await cookieFor(n[who]);
      for (const path of paths) expect((await page(path, cookie)).status, `${who} ${path}`).toBe(200);
      for (const [other, otherPaths] of Object.entries(areas)) {
        if (other === who) continue;
        for (const path of otherPaths) expect(forbidden(await page(path, cookie)), `${who} -> ${path}`).toBe(true);
      }
    }
    expect((await page("/manager/requests")).status).toBe(307);
  });
});
