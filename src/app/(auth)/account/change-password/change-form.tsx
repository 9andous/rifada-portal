"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert } from "@/components/ui/surface";
import { changePasswordAction, type FormState } from "@/server/actions/password";

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field id="currentPassword" label="كلمة المرور الحالية" error={state.errors?.currentPassword} required>
        <Input id="currentPassword" name="currentPassword" type="password" dir="ltr" autoComplete="current-password" required autoFocus aria-invalid={Boolean(state.errors?.currentPassword)} />
      </Field>
      <Field id="newPassword" label="كلمة المرور الجديدة" hint="عشرة أحرف على الأقل، تتضمن حرفًا لاتينيًا ورقمًا." error={state.errors?.newPassword} required>
        <Input id="newPassword" name="newPassword" type="password" dir="ltr" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.newPassword)} />
      </Field>
      <Field id="confirmPassword" label="تأكيد كلمة المرور الجديدة" error={state.errors?.confirmPassword} required>
        <Input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.confirmPassword)} />
      </Field>
      <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ كلمة المرور</SubmitButton>
    </form>
  );
}
