import { Field, Input } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/validation/auth";

/**
 * The officer-account fields (`officer.*`), shared by «جمعية جديدة» and «إنشاء حساب مسؤول» on the
 * association page so both steps ask for exactly the same data.
 */
export function OfficerFields({ errors: e = {} }: { errors?: FieldErrors }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field id="officer.name" label="الاسم الكامل" error={e["officer.name"]} required>
        <Input id="officer.name" name="officer.name" required aria-invalid={Boolean(e["officer.name"])} autoComplete="off" />
      </Field>
      <Field id="officer.username" label="اسم المستخدم" hint="أحرف لاتينية صغيرة وأرقام والرمزان . و _" error={e["officer.username"]} required>
        <Input id="officer.username" name="officer.username" dir="ltr" required aria-invalid={Boolean(e["officer.username"])} autoComplete="off" />
      </Field>
      <Field id="officer.email" label="البريد الإلكتروني" hint="اختياري." error={e["officer.email"]}>
        <Input id="officer.email" name="officer.email" type="email" dir="ltr" aria-invalid={Boolean(e["officer.email"])} autoComplete="off" />
      </Field>
      <Field id="officer.phone" label="رقم الهاتف" hint="اختياري." error={e["officer.phone"]}>
        <Input id="officer.phone" name="officer.phone" type="tel" dir="ltr" aria-invalid={Boolean(e["officer.phone"])} autoComplete="off" />
      </Field>
    </div>
  );
}
