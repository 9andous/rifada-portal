// Request helpers shared by the server, the screens and the tests (isomorphic, no server imports).

import type { Role } from "@/server/authz/roles";
import { FILE_TYPES, type AllowedExtension } from "./uploads";
import type { UploadGroup } from "./validation/settings";

/** The six fixed general fields of every request (D-057). */
// The request form of the design handoff (D-123). «الفئة المستهدفة» and «مكان التنفيذ» are no longer
// asked; requests that have them still show them.
export const GENERAL_FIELDS = ["title", "description", "goals", "expectedBeneficiaries", "startDate", "endDate", "estimatedBudget", "kpis", "partners"] as const;
export type GeneralField = (typeof GENERAL_FIELDS)[number] | "targetAudience" | "location";

/** Text fields required at submission, besides the track, the request type, the budget and the period. */
export const REQUIRED_GENERAL_FIELDS = ["title", "description", "goals", "expectedBeneficiaries"] as const;

export const GENERAL_FIELD_LABELS: Record<GeneralField, string> = {
  title: "اسم المشروع أو البرنامج",
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

/** RF-<hijriYear>-<seq>, the sequence padded to five digits (change 11). */
export function formatReference(hijriYear: number, seq: number): string {
  return `RF-${hijriYear}-${String(seq).padStart(5, "0")}`;
}

/** Download URL of one stored file version (served only by the authorized route, D-074). */
export const fileHref = (requestId: string, versionId: string) => `/api/requests/${requestId}/files/${versionId}`;
