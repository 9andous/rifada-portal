"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Field, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import type { AdminFormState } from "@/server/actions/admin/state";

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;

/** Approve (creates the association and its officer account) or reject with a reason. */
export function RegistrationDecision({ name, approve, reject }: { name: string; approve: Action; reject: Action }) {
  const router = useRouter();
  const after = (action: Action): Action => async (s, f) => {
    const result = await action(s, f);
    if (result.ok) router.refresh();
    return result;
  };
  return (
    <div className="flex flex-col gap-2">
      <FormDialog
        trigger={
          <>
            <Check aria-hidden="true" strokeWidth={1.75} />
            اعتماد الطلب وإنشاء الحساب
          </>
        }
        triggerVariant="primary"
        title="اعتماد طلب التسجيل"
        description={<>تُنشأ جمعية «{name}» في سجل الجمعيات، ويُنشأ حساب مسؤولها باسم المستخدم وكلمة المرور التي اختارها، ويستطيع الدخول فورًا.</>}
        submitLabel="اعتماد"
        action={after(approve)}
      >
        {(errors) => (
          <Field id="approve-note" label="ملاحظة داخلية" hint="اختياري؛ لا تظهر لمقدم الطلب." error={errors.note}>
            <Textarea id="approve-note" name="note" rows={3} maxLength={1000} />
          </Field>
        )}
      </FormDialog>
      <FormDialog
        trigger={
          <>
            <X aria-hidden="true" strokeWidth={1.75} />
            رفض الطلب
          </>
        }
        triggerVariant="danger"
        title="رفض طلب التسجيل"
        description="يظهر السبب لمقدم الطلب في صفحة متابعة الطلب، وتُحذف كلمة المرور المحفوظة."
        submitLabel="رفض الطلب"
        action={after(reject)}
      >
        {(errors) => (
          <Field id="reject-note" label="سبب الرفض" error={errors.note} required>
            <Textarea id="reject-note" name="note" rows={4} maxLength={1000} required aria-invalid={Boolean(errors.note)} />
          </Field>
        )}
      </FormDialog>
    </div>
  );
}
