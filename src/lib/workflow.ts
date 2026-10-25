// Request lifecycle rules (Phase 2b stop 2): pure functions shared by the status editor, its tests
// and, in Phase 3, the workflow engine.

import type { StatusTone } from "@/components/ui/surface";
import type { Role } from "@/server/authz/roles";

/** The seven system statuses; the editor never adds or removes statuses (D-060). */
export const SYSTEM_STATUS_KEYS = ["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED"] as const;
export type SystemStatusKey = (typeof SYSTEM_STATUS_KEYS)[number];

/** Roles that may trigger a manual transition. The super admin is not part of review (D-013). */
export const TRANSITION_ROLES = ["ASSOCIATION_OFFICER", "SUPERVISOR", "UNIT_MANAGER"] as const satisfies readonly Role[];
export type TransitionRole = (typeof TRANSITION_ROLES)[number];

export const STATUS_TONES = ["neutral", "info", "review", "warn", "ok", "bad"] as const satisfies readonly StatusTone[];

export const STATUS_TONE_LABELS: Record<StatusTone, string> = {
  neutral: "رمادي",
  info: "أزرق",
  review: "بنفسجي",
  warn: "كهرماني",
  ok: "أخضر",
  bad: "أحمر",
};

// Tokens written by the Phase 1a seed before the tone names existed (D-068).
const LEGACY_TONES: Record<string, StatusTone> = { primary: "review", warning: "warn", success: "ok", danger: "bad" };

/** The status tone for a stored colour token; unknown values fall back to neutral. */
export function statusTone(token: string): StatusTone {
  if ((STATUS_TONES as readonly string[]).includes(token)) return token as StatusTone;
  return LEGACY_TONES[token] ?? "neutral";
}

export type LifecycleStatus = { id: string; key: string; name: string; isTerminal: boolean };
export type LifecycleTransition = { id?: string; fromStatusId: string; toStatusId: string; allowedRoles: readonly string[]; isAutomatic: boolean };

/**
 * Every rule a lifecycle must satisfy, as Arabic messages (empty when valid):
 * nothing leaves a terminal status; every non-terminal status can reach a terminal one; no
 * duplicate or self transitions; automatic transitions have no roles; manual ones have at least one
 * role, and only the roles that take part in the request lifecycle.
 */
export function validateLifecycle(statuses: readonly LifecycleStatus[], transitions: readonly LifecycleTransition[]): string[] {
  const problems: string[] = [];
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const name = (id: string) => `«${byId.get(id)?.name ?? "حالة غير معروفة"}»`;
  const seen = new Set<string>();

  for (const t of transitions) {
    const from = byId.get(t.fromStatusId);
    const to = byId.get(t.toStatusId);
    if (!from || !to) {
      problems.push("أحد الانتقالات يشير إلى حالة غير موجودة.");
      continue;
    }
    const pair = `${t.fromStatusId}>${t.toStatusId}`;
    if (seen.has(pair)) problems.push(`الانتقال من ${name(t.fromStatusId)} إلى ${name(t.toStatusId)} مكرر.`);
    seen.add(pair);
    if (t.fromStatusId === t.toStatusId) problems.push(`لا يجوز الانتقال من ${name(t.fromStatusId)} إلى الحالة نفسها.`);
    if (from.isTerminal) problems.push(`${name(t.fromStatusId)} حالة نهائية، فلا يجوز الانتقال منها.`);
    if (t.isAutomatic && t.allowedRoles.length > 0) {
      problems.push(`الانتقال من ${name(t.fromStatusId)} إلى ${name(t.toStatusId)} تلقائي، فلا تُسند إليه أدوار.`);
    }
    if (!t.isAutomatic && t.allowedRoles.length === 0) {
      problems.push(`حدّد دورًا واحدًا على الأقل للانتقال من ${name(t.fromStatusId)} إلى ${name(t.toStatusId)}، أو اجعله تلقائيًا.`);
    }
    if (t.allowedRoles.some((r) => !(TRANSITION_ROLES as readonly string[]).includes(r))) {
      problems.push(`أدوار الانتقال من ${name(t.fromStatusId)} إلى ${name(t.toStatusId)} غير صالحة؛ مدير النظام لا يشارك في مراجعة الطلبات.`);
    }
  }

  // Reverse reachability from the terminal statuses.
  const canFinish = new Set(statuses.filter((s) => s.isTerminal).map((s) => s.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of transitions) {
      if (canFinish.has(t.toStatusId) && !canFinish.has(t.fromStatusId) && byId.has(t.fromStatusId)) {
        canFinish.add(t.fromStatusId);
        grew = true;
      }
    }
  }
  if (!statuses.some((s) => s.isTerminal)) problems.push("لا توجد حالة نهائية في دورة الطلب.");
  for (const s of statuses) {
    if (!s.isTerminal && !canFinish.has(s.id)) problems.push(`لا يمكن الوصول من ${name(s.id)} إلى حالة نهائية (معتمد أو مرفوض).`);
  }
  return problems;
}

/** Roles a user may use for a transition (Phase 3): never an automatic one. */
export function canTriggerTransition(transition: Pick<LifecycleTransition, "allowedRoles" | "isAutomatic">, role: Role): boolean {
  return !transition.isAutomatic && transition.allowedRoles.includes(role);
}
