import * as z from "zod";
import { fullNameSchema, requiredEmail, requiredPhone } from "./admin";

// What an association officer may change on «ملف الجمعية» (D-101): the contact details. The name,
// licence, classification and location stay with the super admin.

export const associationProfileSchema = z.object({
  contactName: fullNameSchema,
  contactEmail: requiredEmail,
  contactPhone: requiredPhone,
});

export type AssociationProfileInput = z.infer<typeof associationProfileSchema>;

export function associationProfileFromForm(formData: FormData): Record<string, unknown> {
  return {
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
  };
}
