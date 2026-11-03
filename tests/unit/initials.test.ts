import { describe, expect, it } from "vitest";
import { initials } from "@/lib/images";

const NJ = String.fromCharCode(0x200c);

describe("initials", () => {
  it("takes a person's first and last name", () => {
    expect(initials("سارة بنت محمد العتيبي")).toBe(`س${NJ}ع`);
    expect(initials("مدير النظام")).toBe(`م${NJ}ن`);
    expect(initials("ahmed ali")).toBe(`A${NJ}A`);
  });

  it("takes an association's first two words", () => {
    expect(initials("جمعية سقيا الحرم", "association")).toBe(`ج${NJ}س`);
    expect(initials("جمعية البر بمكة", "association")).toBe(`ج${NJ}ب`);
  });

  it("gives one letter for a one-word name and ignores diacritics and extra spaces", () => {
    expect(initials("  فَهد  ")).toBe("ف");
    expect(initials("رفادة", "association")).toBe("ر");
    expect(initials("")).toBe("-");
  });
});
