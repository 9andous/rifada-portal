// Request helpers shared by the server, the screens and the tests (isomorphic, no server imports).

import type { Role } from "@/server/authz/roles";
import { FILE_TYPES, type AllowedExtension } from "./uploads";
import type { UploadGroup } from "./validation/settings";
import { formatNumber } from "./format";
import { toWesternDigits } from "./validation/admin";

/** The six fixed general fields of every request (D-057). */
// The request form of the design handoff (D-123). «الفئة المستهدفة» and «مكان التنفيذ» are no longer
// asked; requests that have them still show them.
export const GENERAL_FIELDS = ["title", "description", "goals", "expectedBeneficiaries", "startDate", "endDate", "estimatedBudget", "kpis", "partners"] as const;
export type GeneralField = (typeof GENERAL_FIELDS)[number] | "targetAudience" | "location";

/** Text fields required at submission, besides the track, the request type, the budget and the period. */
export const REQUIRED_GENERAL_FIELDS = ["title", "description", "goals", "expectedBeneficiaries", "kpis"] as const;

export const GENERAL_FIELD_LABELS: Record<GeneralField, string> = {
  title: "اسم البرنامج المقترح",
  description: "وصف المشروع",
  goals: "الأهداف والمخرجات المتوقعة",
  expectedBeneficiaries: "الفئات المستهدفة",
  startDate: "تاريخ البداية",
  endDate: "تاريخ النهاية",
  estimatedBudget: "الميزانية التقديرية (ر.س)",
  kpis: "مؤشرات القياس",
  partners: "الشركاء",
  targetAudience: "الفئة المستهدفة",
  location: "مكان التنفيذ",
};

// «الفئات المستهدفة» (D-151): one group per line, each with the number of people it targets, kept as text
// «الاسم — العدد» so every screen, the print and the seal read it as before. A line without a number is
// a group whose count is still to be written (requests from before D-151).
const GROUP_SEPARATOR = " — ";

export type TargetGroup = { name: string; count: string };

/** The groups of «الفئات المستهدفة»; `count` is in Western digits, "" when not written. */
export function parseTargetGroups(text: string | null | undefined): TargetGroup[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.lastIndexOf(GROUP_SEPARATOR.trim());
      if (at > 0) {
        const count = toWesternDigits(line.slice(at + 1)).replace(/[٬,\s]/g, "");
        if (/^\d+$/.test(count)) return { name: line.slice(0, at).trim(), count: String(Number(count)) };
      }
      return { name: line, count: "" };
    });
}

/** The text stored for the groups: rows without a name are dropped. */
export function formatTargetGroups(groups: readonly TargetGroup[]): string {
  return groups
    .map((g) => ({ name: g.name.replace(/\s+/g, " ").trim(), count: toWesternDigits(g.count).replace(/[٬,\s]/g, "") }))
    .filter((g) => g.name)
    .map((g) => (/^\d+$/.test(g.count) ? `${g.name}${GROUP_SEPARATOR}${formatNumber(Number(g.count))}` : g.name))
    .join("\n");
}

// «الأهداف والمخرجات المتوقعة»: the association writes its own goals, each with its measure
// («مؤشر القياس»), kept as text «الهدف — المؤشر», one per line, so every screen, the print and the seal
// read it as text. A line without the separator is a goal whose measure is still to be written
// (requests from before this change, whose goals were picked from the programme's).
export type RequestGoal = { goal: string; measure: string };

/** The goals of «الأهداف والمخرجات المتوقعة»; `measure` is "" when not written. */
export function parseGoals(text: string | null | undefined): RequestGoal[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(GROUP_SEPARATOR);
      return at > 0
        ? { goal: line.slice(0, at).trim(), measure: line.slice(at + GROUP_SEPARATOR.length).trim() }
        : { goal: line, measure: "" };
    });
}

/** The text stored for the goals: rows without a goal are dropped; a dash in the goal would read as the separator. */
export function formatGoals(goals: readonly RequestGoal[]): string {
  return goals
    .map((g) => ({
      goal: g.goal.replace(/\s+/g, " ").replace(/\s*—\s*/g, " - ").trim(),
      measure: g.measure.replace(/\s+/g, " ").trim(),
    }))
    .filter((g) => g.goal)
    .map((g) => (g.measure ? `${g.goal}${GROUP_SEPARATOR}${g.measure}` : g.goal))
    .join("\n");
}

/** «نوع الطلب» as shown: the type's name, with what the association wrote for «أخرى» and the like (D-151). */
export function requestTypeLabel(type: { name: string } | null | undefined, detail: string | null | undefined): string | null {
  if (!type) return null;
  return detail?.trim() ? `${type.name}: ${detail.trim()}` : type.name;
}

/** Statuses in which the request waits on the unit (and counts as open workload). */
export const OPEN_STATUS_KEYS = ["SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED"] as const;
/** Statuses in which the association may edit the request. */
export const EDITABLE_STATUS_KEYS = ["DRAFT", "RETURNED"] as const;

export type Decision = "approve" | "return" | "reject";
export const DECISIONS = ["approve", "return", "reject"] as const;
export const DECISION_STATUS: Record<Decision, "APPROVED" | "RETURNED" | "REJECTED"> = {
  approve: "APPROVED",
  return: "RETURNED",
  reject: "REJECTED",
};
export const DECISION_LABELS: Record<Decision, string> = {
  approve: "اعتماد",
  return: "إعادة للتعديل",
  reject: "رفض",
};

/** The supervisor's recommendation to the unit manager, who decides (D-139). */
export const RECOMMENDATION_LABELS: Record<Decision, string> = {
  approve: "قبول الطلب",
  return: "إعادة الطلب للتعديل",
  reject: "رفض الطلب",
};
export const RECOMMENDATION_TONES: Record<Decision, "ok" | "warn" | "bad"> = { approve: "ok", return: "warn", reject: "bad" };
export const RECOMMENDATION_VALUES = { approve: "APPROVE", return: "RETURN", reject: "REJECT" } as const;
/** The stored recommendation as a decision. */
export const recommendationDecision = (value: "APPROVE" | "RETURN" | "REJECT") => value.toLowerCase() as Decision;

/** One requirement as stored in `requests.requirementsSnapshot` (D-077) or read live. */
export type RequirementSpec = {
  key: string;
  label: string;
  kind: "FIELD" | "ATTACHMENT";
  fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | null;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
  attachmentType: { key: string; name: string; groups: string[] } | null;
};

export function parseRequirementSnapshot(value: unknown): RequirementSpec[] | null {
  return Array.isArray(value) ? (value as RequirementSpec[]) : null;
}

/** Custom field values are stored as strings by requirement key (D-054, D-077). */
export type CustomValues = Record<string, string>;

export function parseCustomValues(value: unknown): CustomValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CustomValues = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === "string") out[k] = v;
  return out;
}

/** The upload group of a stored file, from its MIME type. */
export function groupOfMime(mime: string): UploadGroup | null {
  for (const ext of Object.keys(FILE_TYPES) as AllowedExtension[]) {
    if ((FILE_TYPES[ext].mimes as readonly string[]).includes(mime)) return FILE_TYPES[ext].group;
  }
  return null;
}

/** Where a role opens a request. */
export function requestHref(role: Role, id: string): string {
  switch (role) {
    case "ASSOCIATION_OFFICER":
      return `/association/requests/${id}`;
    case "SUPERVISOR":
      return `/supervisor/requests/${id}`;
    case "UNIT_MANAGER":
      return `/manager/requests/${id}`;
    default:
      return `/admin/requests/${id}`;
  }
}

/** PRH-<hijriYear>-<seq>, the sequence padded to five digits (change 11; prefix PRH since D-150, was RF). */
export function formatReference(hijriYear: number, seq: number): string {
  return `PRH-${hijriYear}-${String(seq).padStart(5, "0")}`;
}

/** Download URL of one stored file version (served only by the authorized route, D-074). */
export const fileHref = (requestId: string, versionId: string) => `/api/requests/${requestId}/files/${versionId}`;
