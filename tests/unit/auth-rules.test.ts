import { describe, expect, it } from "vitest";
import { PASSWORD_MIN, changePasswordSchema, newPasswordSchema } from "@/lib/validation/auth";
import { PASSWORD_MIN_LENGTH, hashPassword, verifyPassword } from "@/server/auth/password";
import { isPlaceholderEmail, placeholderEmail } from "@/server/auth/placeholder-email";

describe("password rules", () => {
  it("keeps the client and server minimum length in sync", () => {
    expect(PASSWORD_MIN).toBe(PASSWORD_MIN_LENGTH);
  });

  it("requires length, a Latin letter and a digit", () => {
    expect(newPasswordSchema.safeParse("short1A").success).toBe(false);
    expect(newPasswordSchema.safeParse("onlyletters").success).toBe(false);
    expect(newPasswordSchema.safeParse("1234567890").success).toBe(false);
    expect(newPasswordSchema.safeParse("valid-pass-2026").success).toBe(true);
  });

  it("rejects a mismatched confirmation and reuse of the current password", () => {
    const ok = { currentPassword: "old-pass-2025", newPassword: "new-pass-2026", confirmPassword: "new-pass-2026" };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: "other-2026x" }).success).toBe(false);
    const reuse = { currentPassword: "same-pass-2026", newPassword: "same-pass-2026", confirmPassword: "same-pass-2026" };
    expect(changePasswordSchema.safeParse(reuse).success).toBe(false);
  });

  it("hashes with argon2id and verifies", async () => {
    const digest = await hashPassword("valid-pass-2026");
    expect(digest.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword({ hash: digest, password: "valid-pass-2026" })).toBe(true);
    expect(await verifyPassword({ hash: digest, password: "wrong-pass-2026" })).toBe(false);
  });

  it("uses a non-deliverable placeholder email when none is given", () => {
    const email = placeholderEmail("Dev.User");
    expect(email).toBe("dev.user@no-email.rifada.invalid");
    expect(isPlaceholderEmail(email)).toBe(true);
    expect(isPlaceholderEmail("someone@example.org")).toBe(false);
  });
});
