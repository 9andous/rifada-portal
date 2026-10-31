import * as z from "zod";
import { isValidDateOnly } from "../completeness";
import { toArabicDigits } from "../format";
import { GENERAL_FIELD_LABELS } from "../requests";
import { toWesternDigits } from "./admin";

// Request form, decision, reassignment and comment inputs. Saving a draft only enforces lengths and
// well-formed dates; what is required is decided by the completeness check at submission.

export const REQUEST_LIMITS = {
  title: 200,
  description: 5000,
  targetAudience: 300,
  goals: 2000,
  location: 300,
  kpis: 1000,
  partners: 500,
  beneficiaries: 2000,
  /** An upper bound that catches a mistyped figure. */
  budget: 100_000_000_000,
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

/** A whole number typed with Western or Arabic-Indic digits and optional thousands separators; empty is null. */
const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const normalized = toWesternDigits(v).replace(/[٬,\s]/g, "");
      if (!/^\d+$/.test(normalized) || Number(normalized) > max) {
        ctx.addIssue({ code: "custom", message: `${label}: اكتبوا رقمًا صحيحًا فقط.` });
        return z.NEVER;
      }
      return Number(normalized);
    });

/** An id from the form; empty keeps the request's current choice. */
const choice = (message: string) => z.string().trim().max(40, message).default("");

export const draftSchema = z.object({
  trackId: choice("المسار المختار غير صالح."),
  requestTypeId: choice("نوع الطلب المختار غير صالح."),
  title: text(GENERAL_FIELD_LABELS.title, REQUEST_LIMITS.title),
  description: text(GENERAL_FIELD_LABELS.description, REQUEST_LIMITS.description),
  goals: text(GENERAL_FIELD_LABELS.goals, REQUEST_LIMITS.goals),
  expectedBeneficiaries: text(GENERAL_FIELD_LABELS.expectedBeneficiaries, REQUEST_LIMITS.beneficiaries),
  startDate: dateOnly(GENERAL_FIELD_LABELS.startDate),
  endDate: dateOnly(GENERAL_FIELD_LABELS.endDate),
  estimatedBudget: wholeNumber(GENERAL_FIELD_LABELS.estimatedBudget, REQUEST_LIMITS.budget),
  kpis: text(GENERAL_FIELD_LABELS.kpis, REQUEST_LIMITS.kpis),
  partners: text(GENERAL_FIELD_LABELS.partners, REQUEST_LIMITS.partners),
});

export type DraftInput = z.infer<typeof draftSchema>;

/** Reads the request form, field by name. */
export function draftFromForm(formData: FormData): Record<string, unknown> {
  const get = (name: string) => String(formData.get(name) ?? "");
  return {
    trackId: get("trackId"),
    requestTypeId: get("requestTypeId"),
    title: get("title"),
    description: get("description"),
    goals: get("goals"),
    expectedBeneficiaries: get("expectedBeneficiaries"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    estimatedBudget: get("estimatedBudget"),
    kpis: get("kpis"),
    partners: get("partners"),
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
