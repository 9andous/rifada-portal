// Form state returned by the admin server actions. Kept apart from the "use server" files, which
// may only export async functions.

import type { FieldErrors } from "@/lib/validation/auth";

/**
 * `credentials` carries a one-time password (D-034). It exists only in this action response and the
 * client component's state: never stored in plaintext, logged, audited, cached or put in a URL.
 */
export type AdminFormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  credentials?: { username: string; password: string };
  /** Id of the record the action created, for the follow-up links. */
  createdId?: string;
};

export const FORBIDDEN_MESSAGE = "لا تملك صلاحية تنفيذ هذا الإجراء.";
export const INVALID_MESSAGE = "لم تُحفظ البيانات؛ صحّح الحقول المشار إليها.";
