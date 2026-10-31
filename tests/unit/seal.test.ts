import { describe, expect, it } from "vitest";
import { normalizeVerifyCode } from "@/lib/verify-code";
import { canonical, newVerifyCode } from "@/server/seal/seal";

describe("canonical JSON", () => {
  it("is the same text whatever the key order, at every depth", () => {
    expect(canonical({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}');
    expect(canonical({ a: undefined, b: new Date("2026-10-30T00:00:00.000Z") })).toBe('{"b":"2026-10-30T00:00:00.000Z"}');
  });
});

describe("verification codes", () => {
  it("are issued as XXXX-XXXX-XXXX and read back however they are typed or scanned", () => {
    const code = newVerifyCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeVerifyCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
    expect(normalizeVerifyCode(`https://rifada.example/verify/${code}?x=1`)).toBe(code);
    // Letters that are easily misread map to their digits.
    expect(normalizeVerifyCode("O0IL-ABCD-EFGH")).toBe("0011-ABCD-EFGH");
  });

  it("rejects anything that cannot be a code", () => {
    expect(normalizeVerifyCode("")).toBeNull();
    expect(normalizeVerifyCode("ABCD-EFGH")).toBeNull();
    expect(normalizeVerifyCode("ABCD-EFGH-IJKU")).toBeNull();
    expect(normalizeVerifyCode("https://other.example/page")).toBeNull();
  });
});
