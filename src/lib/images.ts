// Profile pictures and association logos: limits shared by the upload field, the upload route and
// the services, the URL they are served from, and the letters shown when there is no image.

/** Upload context of a staged image, so a document upload cannot be used as a picture. */
export const IMAGE_CONTEXT = "image";
export const IMAGE_MAX_MB = 2;
export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export type ImageOwner = "user" | "association";

/**
 * Where an owner's image is served. The storage key's tail is part of the URL, so a replaced
 * image gets a new address and the long browser cache never shows the old one.
 */
export function imageUrl(owner: ImageOwner, id: string, key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/images/${owner}/${id}?v=${key.slice(-8)}`;
}

/** Zero-width non-joiner: keeps two Arabic initials apart instead of joining them into a word. */
const NON_JOINER = String.fromCharCode(0x200c);
/** Diacritics (harakat) and other combining marks, dropped before taking a letter. */
const MARKS = /\p{M}/gu;

/**
 * The letters shown in place of a picture.
 * - A person: the first letter of the first name and of the last name («سارة بنت محمد العتيبي»
 *   gives «س ع»).
 * - An association: the first letter of each of the first two words («جمعية سقيا الحرم» gives «ج س»).
 * A one-word name gives its first letter only. A leading article «ال» is skipped.
 */
export function initials(name: string, kind: "person" | "association" = "person"): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(MARKS, ""))
    .filter(Boolean);
  if (words.length === 0) return "-";
  // The article «ال» says nothing about the name: «العتيبي» gives «ع», «النظام» gives «ن».
  const first = (word: string) => (Array.from(word.length > 3 && word.startsWith("ال") ? word.slice(2) : word)[0] ?? "").toUpperCase();
  if (words.length === 1) return first(words[0]);
  const second = kind === "person" ? words[words.length - 1] : words[1];
  return first(words[0]) + NON_JOINER + first(second);
}
