"use client";

import Link from "next/link";
import { Building2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import type { AdminFormState } from "@/server/actions/admin/state";

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;

/**
 * Approve (creates the association and its account) or reject with a reason. Rendered whatever the
 * status, so after an approval the page can refresh while the one-time password stays on screen
 * until the super admin leaves (D-034, D-149). `decided` is what a decided application shows.
 */
export function RegistrationDecision({
  name,
  email,
  canDecide,
  approve,
  reject,
  decided,
}: {
  name: string;
  email: string | null;
  canDecide: boolean;
  approve: Action;
  reject: Action;
  decided: ReactNode;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<{ id?: string; credentials?: { username: string; password: string } } | null>(null);
  const after =
    (action: Action, keep: boolean): Action =>
    async (s, f) => {
      const result = await action(s, f);
      if (result.ok) {
        if (keep) setCreated({ id: result.createdId, credentials: result.credentials });
        router.refresh();
      }
      return result;
    };

  if (created) {
    return (
      <div className="flex flex-col gap-3">
        {created.credentials ? (
          <OneTimeSecret title="اعتُمد الطلب وأُنشئ حساب الجمعية" username={created.credentials.username} usernameLabel="البريد الإلكتروني (اسم الدخول)" password={created.credentials.password} />
        ) : (
          <p className="text-sm text-ink-muted">اعتُمد الطلب وأُنشئ حساب الجمعية باسم المستخدم وكلمة المرور التي اختارها مقدم الطلب.</p>
        )}
        {created.id ? (
          <Link href={`/admin/associations/${created.id}`} className={buttonClasses("outline", "md", "w-full")}>
            <Building2 aria-hidden="true" strokeWidth={1.75} />
            ملف الجمعية
          </Link>
        ) : null}
      </div>
    );
  }
  if (!canDecide) return <>{decided}</>;

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-2 text-sm leading-relaxed text-ink-muted">تحقّق من رقم الترخيص والخطاب وأماكن تقديم الخدمة قبل الاعتماد.</p>
      <FormDialog
        trigger={
          <>
            <Check aria-hidden="true" strokeWidth={1.75} />
            اعتماد الطلب وإنشاء الحساب
          </>
        }
        triggerVariant="primary"
        title="اعتماد طلب التسجيل"
        description={
          <>
            تُنشأ جمعية «{name}» في سجل الجمعيات، ويُنشأ حسابها{" "}
            {email ? (
              <>
                باسم الدخول <bdi dir="ltr">{email}</bdi>
              </>
            ) : null}{" "}
            بكلمة مرور مؤقتة تظهر لك مرة واحدة، وتُغيّرها الجمعية عند أول دخول.
          </>
        }
        submitLabel="اعتماد"
        action={after(approve, true)}
      >
        {(errors) => (
          <Field id="approve-note" label="ملاحظة داخلية" hint="اختياري؛ لا تظهر للجمعية." error={errors.note}>
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
        description="يظهر السبب للجمعية في صفحة متابعة طلب التسجيل."
        submitLabel="رفض الطلب"
        action={after(reject, false)}
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
