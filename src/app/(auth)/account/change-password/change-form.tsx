"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/form-bits";
import { FormError } from "@/components/ui/surface";
import { changePasswordAction, type FormState } from "@/server/actions/password";

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <FormError>{state.message}</FormError> : null}
      <Field id="currentPassword" label="كلمة المرور الحالية" error={state.errors?.currentPassword} required>
        <PasswordInput id="currentPassword" name="currentPassword" dir="ltr" autoComplete="current-password" required autoFocus aria-invalid={Boolean(state.errors?.currentPassword)} />
      </Field>
      <Field id="newPassword" label="كلمة المرور الجديدة" hint="عشرة أحرف على الأقل، تتضمن حرفًا لاتينيًا ورقمًا." error={state.errors?.newPassword} required>
        <PasswordInput id="newPassword" name="newPassword" dir="ltr" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.newPassword)} />
      </Field>
      <Field id="confirmPassword" label="تأكيد كلمة المرور الجديدة" error={state.errors?.confirmPassword} required>
        <PasswordInput id="confirmPassword" name="confirmPassword" dir="ltr" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.confirmPassword)} />
      </Field>
      <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ كلمة المرور</SubmitButton>
    </form>
  );
}
