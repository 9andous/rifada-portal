"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert } from "@/components/ui/surface";
import { resetPasswordAction, type FormState } from "@/server/actions/password";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{state.message}</Alert>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          الانتقال إلى تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field id="newPassword" label="كلمة المرور الجديدة" hint="عشرة أحرف على الأقل، تتضمن حرفًا لاتينيًا ورقمًا." error={state.errors?.newPassword} required>
        <Input id="newPassword" name="newPassword" type="password" dir="ltr" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.newPassword)} />
      </Field>
      <Field id="confirmPassword" label="تأكيد كلمة المرور" error={state.errors?.confirmPassword} required>
        <Input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.confirmPassword)} />
      </Field>
      <SubmitButton pendingLabel="جارٍ الحفظ…">تعيين كلمة المرور</SubmitButton>
    </form>
  );
}
