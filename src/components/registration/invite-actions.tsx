"use client";

import { Ban, TimerReset } from "lucide-react";
import { useRouter } from "next/navigation";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { formatNumber } from "@/lib/format";
import type { AdminFormState } from "@/server/actions/admin/state";

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;

/** Change how long a waiting link stays valid, or withdraw it (D-149). */
export function InviteActions({ renew, cancel, defaultHours }: { renew: Action; cancel: Action; defaultHours: number }) {
  const router = useRouter();
  const after =
    (action: Action): Action =>
    async (s, f) => {
      const result = await action(s, f);
      if (result.ok) router.refresh();
      return result;
    };
  return (
    <div className="flex flex-col gap-2">
      <FormDialog
        trigger={
          <>
            <TimerReset aria-hidden="true" strokeWidth={1.75} />
            تعديل مدة الصلاحية
          </>
        }
        title="تعديل مدة صلاحية الرابط"
        description="تُحسب المدة الجديدة من الآن، ويبقى الرابط نفسه. يمكن بها أيضًا إعادة فتح رابط انتهت صلاحيته."
        submitLabel="حفظ المدة"
        action={after(renew)}
      >
        {(errors) => (
          <Field id="invite-hours" label="المدة بالساعات" hint={`من ١ إلى ٧٢٠ ساعة. المدة الافتراضية في الإعدادات ${formatNumber(defaultHours)} ساعة.`} error={errors.hours} required>
            <Input id="invite-hours" name="hours" type="number" inputMode="numeric" min={1} max={720} step={1} dir="ltr" defaultValue={defaultHours} className="w-32" aria-invalid={Boolean(errors.hours)} />
          </Field>
        )}
      </FormDialog>
      <FormDialog
        trigger={
          <>
            <Ban aria-hidden="true" strokeWidth={1.75} />
            إلغاء الرابط
          </>
        }
        triggerVariant="danger"
        title="إلغاء رابط التسجيل"
        description="يتوقف الرابط فورًا وينتقل الطلب إلى «المرفوضة»، ويُتاح رقم الترخيص والبريد الإلكتروني لإضافة الجمعية من جديد."
        submitLabel="إلغاء الرابط"
        action={after(cancel)}
      >
        {(errors) => (
          <Field id="cancel-note" label="السبب" hint="اختياري؛ يُحفظ في سجل الطلب." error={errors.note}>
            <Textarea id="cancel-note" name="note" rows={3} maxLength={1000} />
          </Field>
        )}
      </FormDialog>
    </div>
  );
}
