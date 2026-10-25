import { describe, expect, it } from "vitest";
import { checkFileName } from "@/lib/uploads";
import { arabicList, ltr } from "@/lib/format";
import { ALLOWED_FILE_TYPES_TEXT, UPLOAD_GROUP_LABELS, UPLOAD_GROUPS } from "@/lib/validation/settings";

// Owner, Phase 2b stop 2 review: a «و» glued to a Latin word («وWord») was rendered on the far side
// of the word and read as a stray «g». Mixed Arabic and Latin text must isolate every Latin run.

const LRI = "⁦";
const PDI = "⁩";

/** The text with every isolated run removed: what is left must hold no Latin letter. */
function outsideIsolates(text: string): string {
  return text.replace(/⁦[^⁦⁩]*⁩/g, "");
}

function assertIsolated(text: string) {
  expect(text, "an Arabic letter touches a Latin one").not.toMatch(/[ء-ي][A-Za-z]|[A-Za-z][ء-ي]/);
  expect(outsideIsolates(text), "a Latin run is not isolated").not.toMatch(/[A-Za-z]/);
  expect(text.split(LRI).length, "unbalanced isolates").toBe(text.split(PDI).length);
  expect(text, "a glued «و» before an isolate").not.toMatch(/و⁦/);
}

describe("mixed Arabic and Latin text", () => {
  it("ltr() wraps a fragment in a left-to-right isolate", () => {
    expect(ltr("PDF")).toBe(`${LRI}PDF${PDI}`);
  });

  it("arabicList() separates with the Arabic comma and never a glued «و»", () => {
    expect(arabicList(["أ", "ب", "ج"])).toBe("أ، ب، ج");
  });

  it.each(UPLOAD_GROUPS)("upload group label «%s» isolates its Latin names", (group) => {
    assertIsolated(UPLOAD_GROUP_LABELS[group]);
  });

  it("the allowed-types text lists every group, isolated and comma-separated", () => {
    assertIsolated(ALLOWED_FILE_TYPES_TEXT);
    for (const name of ["PDF", "Word (docx)", "Excel (xlsx)", "PNG", "JPEG", "WebP"]) {
      expect(ALLOWED_FILE_TYPES_TEXT).toContain(ltr(name));
    }
    expect(ALLOWED_FILE_TYPES_TEXT).toContain("، ");
  });

  it("the refusal for a disallowed type uses the same isolated text", () => {
    const result = checkFileName("نموذج.doc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(ALLOWED_FILE_TYPES_TEXT);
      assertIsolated(result.message);
    }
  });
});
