import * as z from "zod";
import { isValidDateOnly } from "../completeness";
import { toArabicDigits } from "../format";
import { GENERAL_FIELD_LABELS } from "../requests";

// Request form, decision, reassignment and comment inputs. Saving a draft only enforces lengths and
// well-formed dates; what is required is decided by the completeness check at submission.

export const REQUEST_LIMITS = {
  title: 200,
  description: 5000,
  targetAudience: 300,
  location: 300,
  customText: 500,
  customLong: 5000,
  reason: 2000,
  comment: 5000,
  commentFiles: 5,
} as const;

const tooLong = (label: string, max: number) => `${label} أطول من الحد المسموح به (${toArabicDigits(max)} حرف).`;

const text = (label: string, max: number) => z.string().trim().max(max, tooLong(label, max));

const dateOnly = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isValidDateOnly(v), `${label} غير صالح.`);

export const draftSchema = z.object({
  title: text(GENERAL_FIELD_LABELS.title, REQUEST_LIMITS.title),
  description: text(GENERAL_FIELD_LABELS.description, REQUEST_LIMITS.description),
  targetAudience: text(GENERAL_FIELD_LABELS.targetAudience, REQUEST_LIMITS.targetAudience),
  location: text(GENERAL_FIELD_LABELS.location, REQUEST_LIMITS.location),
  startDate: dateOnly(GENERAL_FIELD_LABELS.startDate),
  endDate: dateOnly(GENERAL_FIELD_LABELS.endDate),
  custom: z.record(z.string(), z.string().trim().max(REQUEST_LIMITS.customLong, tooLong("قيمة الحقل", REQUEST_LIMITS.customLong))),
});

export type DraftInput = z.infer<typeof draftSchema>;

/** Reads the request form: general fields by name, initiative fields as `custom.<key>`. */
export function draftFromForm(formData: FormData): Record<string, unknown> {
  const custom: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("custom.") && typeof value === "string") custom[name.slice("custom.".length)] = value;
  }
  const get = (name: string) => String(formData.get(name) ?? "");
  return {
    title: get("title"),
    description: get("description"),
    targetAudience: get("targetAudience"),
    location: get("location"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    custom,
  };
}

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "اكتب السبب (ثلاثة أحرف على الأقل).")
  .max(REQUEST_LIMITS.reason, tooLong("السبب", REQUEST_LIMITS.reason));

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "اكتب نص التعليق.")
  .max(REQUEST_LIMITS.comment, tooLong("التعليق", REQUEST_LIMITS.comment));
