import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { safeRemove } from "../../scripts/safe-remove.mjs";

const made: string[] = [];
function tmp(prefix: string) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("safe-remove (D-091)", () => {
  it("unlinks junctions without touching their targets, then deletes the copy", () => {
    const outside = tmp("rifada-target-");
    writeFileSync(path.join(outside, "keep.txt"), "must survive");
    const scratch = tmp("rifada-scratch-");
    const copy = path.join(scratch, "copy");
    mkdirSync(path.join(copy, ".next", "node_modules"), { recursive: true });
    symlinkSync(outside, path.join(copy, "node_modules"), "junction");
    symlinkSync(outside, path.join(copy, ".next", "node_modules", "pg-abc"), "junction");
    writeFileSync(path.join(copy, "file.txt"), "x");

    const result = safeRemove(scratch, copy);
    expect(result.removed).toBe(true);
    expect(result.removedLinks).toHaveLength(2);
    expect(existsSync(copy)).toBe(false);
    expect(existsSync(path.join(outside, "keep.txt"))).toBe(true);
  });

  it("refuses paths outside the scratch folder, the root itself and the project", () => {
    const scratch = tmp("rifada-scratch-");
    const other = tmp("rifada-other-");
    expect(() => safeRemove(scratch, other)).toThrow(/not inside/);
    expect(() => safeRemove(scratch, scratch)).toThrow(/not inside/);
    expect(() => safeRemove(path.resolve("."), path.resolve("src"))).toThrow(/overlaps the project/);
  });

  it("refuses a real node_modules folder inside the target", () => {
    const scratch = tmp("rifada-scratch-");
    const copy = path.join(scratch, "copy");
    mkdirSync(path.join(copy, "node_modules", "pg"), { recursive: true });
    writeFileSync(path.join(copy, "node_modules", "pg", "package.json"), "{}");
    expect(() => safeRemove(scratch, copy)).toThrow(/real node_modules/);
    expect(existsSync(path.join(copy, "node_modules", "pg"))).toBe(true);
  });
});
