// Temporary passwords for new accounts and admin resets. Shown once to the super admin, never
// stored in plaintext; the account keeps `mustChangePassword` on.

import { randomInt } from "node:crypto";

// No look-alike characters (0/O, 1/l/I) so the password can be read aloud or copied by hand.
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;
export const TEMP_PASSWORD_LENGTH = 14;

/** 14 characters from a 55-symbol alphabet (about 80 bits), with at least one letter and one digit. */
export function generateTemporaryPassword(): string {
  const chars = Array.from({ length: TEMP_PASSWORD_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]);
  chars[randomInt(TEMP_PASSWORD_LENGTH)] = DIGITS[randomInt(DIGITS.length)];
  if (!chars.some((c) => LETTERS.includes(c))) {
    const digitPositions = chars.flatMap((c, i) => (DIGITS.includes(c) ? [i] : []));
    // Keep one digit; replace another position with a letter.
    const keep = digitPositions[0];
    const target = digitPositions.find((i) => i !== keep) ?? (keep + 1) % TEMP_PASSWORD_LENGTH;
    chars[target] = LETTERS[randomInt(LETTERS.length)];
  }
  return chars.join("");
}
