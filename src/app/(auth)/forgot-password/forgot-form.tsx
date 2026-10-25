"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert } from "@/components/ui/surface";
import { requestPasswordResetAction, type FormState } from "@/server/actions/password";

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordResetAction, {});

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{state.message}</Alert>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          العودة إلى تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field id="username" label="اسم المستخدم" error={state.errors?.username} required>
        <Input id="username" name="username" dir="ltr" autoComplete="username" required autoFocus aria-invalid={Boolean(state.errors?.username)} />
      </Field>
      <SubmitButton pendingLabel="جارٍ الإرسال…">إرسال رابط إعادة التعيين</SubmitButton>
      <Link href="/login" className="text-center text-sm text-primary underline-offset-4 hover:underline">
        العودة إلى تسجيل الدخول
      </Link>
    </form>
  );
}
