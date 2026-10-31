// Verification codes of sealed documents (D-122): 12 Crockford base32 characters shown as
// XXXX-XXXX-XXXX. Crockford has no I, L, O or U, so a code read aloud or typed by hand is not misread.
// Shared by the server (issuing, checking) and the scanner (reading a QR code).

export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 12;

export const formatVerifyCode = (chars: string) => `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;

/** A typed or scanned code in its stored form, or null when it cannot be one. Accepts the full link. */
export function normalizeVerifyCode(input: string): string | null {
  let text = input.trim();
  const fromLink = /\/verify\/([^/?#\s]+)/i.exec(text);
  if (fromLink) {
    try {
      text = decodeURIComponent(fromLink[1]);
    } catch {
      return null;
    }
  }
  const chars = text
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (chars.length !== CODE_LENGTH || [...chars].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return formatVerifyCode(chars);
}
