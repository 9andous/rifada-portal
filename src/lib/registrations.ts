// Display of association registration statuses (D-094, D-149).

export const REGISTRATION_STATUS = {
  INVITED: { tone: "warn", label: "بانتظار الجمعية" },
  PENDING: { tone: "info", label: "قيد المراجعة" },
  APPROVED: { tone: "ok", label: "معتمد" },
  REJECTED: { tone: "bad", label: "مرفوض" },
} as const;

/** The registration link of a token, relative to the site. */
export function registrationLinkPath(token: string): string {
  return `/register/${token}`;
}

/** Whether a waiting registration's link still works at `now`. */
export function inviteOpen(expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() > now.getTime());
}
