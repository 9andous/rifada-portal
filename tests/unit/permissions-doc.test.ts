import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderPermissionsDoc } from "@/server/authz/permissions-doc";

describe("docs/PERMISSIONS.md", () => {
  it("matches the permission matrix in code (run `npm run docs:permissions` to update)", () => {
    const onDisk = readFileSync(new URL("../../docs/PERMISSIONS.md", import.meta.url), "utf8");
    expect(onDisk).toBe(renderPermissionsDoc());
  });
});
