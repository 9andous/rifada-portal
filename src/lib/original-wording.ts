// "Editing a name keeps the original wording in the source note" (Phase 2b stop 1).

const MARK = "النص الأصلي";

/**
 * Returns the source note to store after a name or text changes from `before` to `after`.
 * The first change appends the original wording; later changes keep the note as it is, so the
 * wording from the source document is never lost or overwritten. Notes from the Phase 1b extraction
 * that already record an original («النص الأصلي: …») are left untouched.
 */
export function keepOriginalWording(note: string | null, before: string, after: string): string | null {
  if (before.trim() === after.trim()) return note;
  if (note?.includes(MARK)) return note;
  const line = `${MARK} قبل التعديل: «${before.trim()}».`;
  return note?.trim() ? `${note.trim()}\n${line}` : line;
}
