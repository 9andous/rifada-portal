import "server-only";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/authz/scope";
import type { Refusal } from "@/server/services/admin/common";
import { FORBIDDEN_MESSAGE, type AdminFormState } from "./state";

/**
 * Runs an admin action for the signed-in user. Authorization is decided by the service (which
 * throws ForbiddenError); a denial becomes an Arabic message instead of an error page.
 */
export async function asAdmin<S extends AdminFormState = AdminFormState>(run: (user: CurrentUser) => Promise<S>): Promise<S> {
  const user = await requireUser();
  try {
    return await run(user);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: FORBIDDEN_MESSAGE } as S;
    throw error;
  }
}

export function fromRefusal(refusal: Refusal): AdminFormState {
  return { ok: false, message: refusal.message, errors: refusal.errors };
}
