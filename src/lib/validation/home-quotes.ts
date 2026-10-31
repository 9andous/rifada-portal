import * as z from "zod";
import { HERO_QUOTE_STYLES } from "@/server/settings/defaults";

// Leadership statements of the home page hero (D-096).

export const HOME_QUOTE_LIMITS = { quote: 400, name: 120, honorific: 80, title: 120 } as const;

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `أدخل ${label}.`)
    .max(max, `يجب ألا يزيد ${label} على ${max} حرفًا.`);

const optionalText = (label: string, max: number) => z.string().trim().max(max, `يجب ألا يزيد ${label} على ${max} حرفًا.`);

export const homeQuoteSchema = z.object({
  quote: text("نص الكلمة", HOME_QUOTE_LIMITS.quote),
  name: text("الاسم", HOME_QUOTE_LIMITS.name),
  honorific: optionalText("اللقب", HOME_QUOTE_LIMITS.honorific),
  title: optionalText("الصفة", HOME_QUOTE_LIMITS.title),
  isActive: z.boolean(),
});

export type HomeQuoteInput = z.infer<typeof homeQuoteSchema>;

export function homeQuoteFromForm(formData: FormData): Record<string, unknown> {
  return {
    quote: String(formData.get("quote") ?? ""),
    name: String(formData.get("name") ?? ""),
    honorific: String(formData.get("honorific") ?? ""),
    title: String(formData.get("title") ?? ""),
    isActive: formData.get("isActive") === "on",
  };
}

export const heroQuoteStyleSchema = z.enum(HERO_QUOTE_STYLES, { error: "اختر شكلًا من الشكلين." });
