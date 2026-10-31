// The completeness check (brief §7): deterministic and rule-based, run on every submission. It
// returns the precise list of what is missing, in Arabic and in form order; an empty list passes.
// Pure function: the caller loads the request, the requirements as they stand now, the files and
// the availability flags, and persists the result (CompletenessCheck, ranBy RULES).

import { arabicList } from "./format";
import { GENERAL_FIELD_LABELS, REQUIRED_GENERAL_FIELDS, groupOfMime, type CustomValues, type RequirementSpec } from "./requests";
import { UPLOAD_GROUP_LABELS, type UploadGroup } from "./validation/settings";
import { toWesternDigits } from "./validation/admin";

export type MissingCode =
  | "association_inactive"
  | "track_missing"
  | "track_unavailable"
  | "request_type_missing"
  | "request_type_unavailable"
  | "program_unavailable"
  | "initiative_unavailable"
  | "general_missing"
  | "date_invalid"
  | "start_in_past"
  | "end_before_start"
  | "span_too_long"
  | "field_missing"
  | "field_not_number"
  | "field_not_date"
  | "field_bad_option"
  | "attachment_missing"
  | "attachment_wrong_type";

export type MissingItem = { code: MissingCode; field: string; message: string };

export type CompletenessInput = {
  general: {
    title: string | null;
    description: string | null;
    goals: string | null;
    expectedBeneficiaries: string | null;
    estimatedBudget: number | null;
    startDate: Date | null;
    endDate: Date | null;
  };
  custom: CustomValues;
  requirements: readonly RequirementSpec[];
  /** Current version of every file attached to the request itself (not comment files). */
  files: readonly { typeKey: string | null; mime: string }[];
  /** `uploads.allowedGroups` from the settings. */
  allowedGroups: readonly string[];
  /** The track and the request type the association chose (D-123): null when not chosen. */
  availability: {
    associationActive: boolean;
    track: { name: string; available: boolean } | null;
    requestType: { name: string; available: boolean } | null;
  };
  /** Kept for the callers; the «start date is today or later» rule now applies on every submission (D-123). */
  firstSubmission: boolean;
  /** Today in Asia/Riyadh, YYYY-MM-DD. */
  today: string;
};

const MAX_SPAN_DAYS = 5 * 366;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** A number typed with Western or Arabic-Indic digits and an optional decimal part. */
export function parseNumberValue(value: string): number | null {
  const normalized = toWesternDigits(value.trim()).replace(/[٫,]/g, ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

const quoted = (label: string) => `«${label}»`;

export function checkCompleteness(input: CompletenessInput): MissingItem[] {
  const missing: MissingItem[] = [];
  const add = (code: MissingCode, field: string, message: string) => missing.push({ code, field, message });
  const { availability: a } = input;

  if (!a.associationActive) add("association_inactive", "association", "حساب الجمعية غير نشط، فلا يمكن تقديم الطلب.");
  if (!a.track) add("track_missing", "trackId", "المسار المستهدف مطلوب.");
  else if (!a.track.available) add("track_unavailable", "trackId", `المسار ${quoted(a.track.name)} مؤرشف حاليًا؛ اختاروا مسارًا آخر.`);
  if (!a.requestType) add("request_type_missing", "requestTypeId", "نوع الطلب مطلوب.");
  else if (!a.requestType.available) add("request_type_unavailable", "requestTypeId", `نوع الطلب ${quoted(a.requestType.name)} موقوف حاليًا؛ اختاروا نوعًا آخر.`);

  const g = input.general;
  for (const field of REQUIRED_GENERAL_FIELDS) {
    if (!g[field]?.trim()) add("general_missing", field, `${GENERAL_FIELD_LABELS[field]} مطلوب.`);
  }
  const start = g.startDate && !Number.isNaN(g.startDate.getTime()) ? g.startDate.toISOString().slice(0, 10) : null;
  const end = g.endDate && !Number.isNaN(g.endDate.getTime()) ? g.endDate.toISOString().slice(0, 10) : null;
  if (!start) add("general_missing", "startDate", `${GENERAL_FIELD_LABELS.startDate} مطلوب.`);
  if (!end) add("general_missing", "endDate", `${GENERAL_FIELD_LABELS.endDate} مطلوب.`);
  if (g.estimatedBudget === null) add("general_missing", "estimatedBudget", `${GENERAL_FIELD_LABELS.estimatedBudget} مطلوبة.`);
  if (start && start < input.today) {
    add("start_in_past", "startDate", "تاريخ البداية يجب أن يكون اليوم أو بعده.");
  }
  if (start && end && end < start) add("end_before_start", "endDate", "تاريخ النهاية يجب ألا يسبق تاريخ البداية.");
  if (start && end && end >= start) {
    const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
    if (days > MAX_SPAN_DAYS) add("span_too_long", "endDate", "مدة التنفيذ تزيد على خمس سنوات؛ تحقق من التاريخين.");
  }

  const ordered = [...input.requirements].sort((x, y) => x.sortOrder - y.sortOrder || x.key.localeCompare(y.key));
  for (const r of ordered.filter((x) => x.kind === "FIELD")) {
    const field = `custom.${r.key}`;
    const value = (input.custom[r.key] ?? "").trim();
    if (!value) {
      if (r.isRequired) add("field_missing", field, `الحقل ${quoted(r.label)} مطلوب.`);
      continue;
    }
    if (r.fieldType === "NUMBER" && parseNumberValue(value) === null) add("field_not_number", field, `الحقل ${quoted(r.label)} يجب أن يكون رقمًا.`);
    if (r.fieldType === "DATE" && !isValidDateOnly(value)) add("field_not_date", field, `الحقل ${quoted(r.label)} يجب أن يكون تاريخًا صحيحًا.`);
    if (r.fieldType === "SELECT" && !r.options.includes(value)) add("field_bad_option", field, `قيمة الحقل ${quoted(r.label)} ليست من الخيارات المتاحة.`);
  }

  for (const r of ordered.filter((x) => x.kind === "ATTACHMENT" && x.isRequired)) {
    const field = `attachment.${r.key}`;
    const typeKey = r.attachmentType?.key ?? r.key;
    const files = input.files.filter((f) => f.typeKey === typeKey);
    if (files.length === 0) {
      add("attachment_missing", field, `المرفق ${quoted(r.label)} مطلوب: أرفق ملفًا واحدًا على الأقل.`);
      continue;
    }
    const groups = acceptedGroups(r, input.allowedGroups);
    if (!files.some((f) => {
      const group = groupOfMime(f.mime);
      return group !== null && groups.includes(group);
    })) {
      add("attachment_wrong_type", field, `ملفات المرفق ${quoted(r.label)} ليست من الأنواع المقبولة له (${arabicList(groups.map((x) => UPLOAD_GROUP_LABELS[x]))}).`);
    }
  }
  return missing;
}

/** The groups a requirement accepts: its attachment type's groups that the settings still allow (D-056). */
export function acceptedGroups(r: Pick<RequirementSpec, "attachmentType">, allowedGroups: readonly string[]): UploadGroup[] {
  const own = r.attachmentType?.groups ?? [];
  return (["pdf", "word", "excel", "image"] as const).filter((g) => own.includes(g) && allowedGroups.includes(g));
}
