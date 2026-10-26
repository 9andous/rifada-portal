"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ChevronLeft, Fingerprint, LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { toArabicDigits } from "@/lib/format";

type AuthError = { status?: number; code?: string } | null | undefined;

function messageFor(error: AuthError): string {
  if (!error) return "تعذّر تسجيل الدخول. حاول مرة أخرى.";
  if (error.status === 429) return "تجاوزت عدد المحاولات المسموح بها. انتظر دقيقة ثم حاول مرة أخرى.";
  switch (error.code) {
    case "INVALID_USERNAME_OR_PASSWORD":
      return "اسم المستخدم أو كلمة المرور غير صحيحة.";
    case "FAILED_TO_CREATE_SESSION":
      return "لا يمكن الدخول بهذا الحساب حاليًا. تواصل مع مدير النظام.";
    case "INVALID_NATIONAL_ID":
      return "رقم الهوية الوطنية يجب أن يتكون من عشرة أرقام ويبدأ بالرقم ١ أو ٢.";
    case "TRANSACTION_EXPIRED":
      return "انتهت صلاحية طلب التحقق. ابدأ طلبًا جديدًا.";
    case "NOT_LINKED":
      return "لا يوجد حساب في المنصة مرتبط برقم الهوية هذا.";
    default:
      return "تعذّر تسجيل الدخول. حاول مرة أخرى.";
  }
}

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"password" | "nafath">("password");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const { error: authError } = await authClient.signIn.username({
        username: String(form.get("username") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      if (authError) {
        setError(messageFor(authError));
        return;
      }
      router.replace(safeNext());
      router.refresh();
    });
  }

  if (mode === "nafath") {
    return <NafathMockFlow onCancel={() => setMode("password")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field id="username" label="اسم المستخدم" required>
          <Input id="username" name="username" autoComplete="username" dir="ltr" required autoFocus className="h-12" />
        </Field>
        <Field id="password" label="كلمة المرور" required>
          <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required className="h-12" />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </div>
        <Button type="submit" variant="dark" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          {pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        أو
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setMode("nafath")}
          className="flex w-full items-center gap-3.5 rounded-lg border-[1.5px] border-primary bg-primary-soft/60 px-4 py-3.5 text-start transition-colors hover:bg-primary-soft"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-ink">
            <Fingerprint aria-hidden="true" className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-brand-ink">الدخول عبر النفاذ الوطني الموحد</span>
            <span className="block text-[0.8125rem] text-ink-muted">باستخدام رقم الهوية الوطنية وتطبيق نفاذ</span>
          </span>
          <ChevronLeft aria-hidden="true" className="size-5 shrink-0 text-ink-subtle" />
        </button>
        <p className="t-caption text-center">الدخول عبر النفاذ الوطني في هذه البيئة محاكاة لأغراض التطوير.</p>
      </div>
    </div>
  );
}

// MOCK: simulates the Nafath app approval. See src/server/identity/nafath-mock-plugin.ts.
function NafathMockFlow({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ transactionId: string; code: string } | null>(null);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nationalId = String(new FormData(event.currentTarget).get("nationalId") ?? "");
    setError(null);
    startTransition(async () => {
      const { data, error: startError } = await authClient.$fetch<{ transactionId: string; code: string }>(
        "/nafath-mock/start",
        { method: "POST", body: { nationalId } },
      );
      if (startError || !data) return setError(messageFor(startError));
      setChallenge(data);
    });
  }

  function approve() {
    if (!challenge) return;
    setError(null);
    startTransition(async () => {
      const { error: completeError } = await authClient.$fetch("/nafath-mock/complete", {
        method: "POST",
        body: { transactionId: challenge.transactionId },
      });
      if (completeError) {
        setChallenge(null);
        return setError(messageFor(completeError));
      }
      router.replace(safeNext());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Alert tone="warning" title="بيئة محاكاة">
        هذا الدخول محاكاة لخدمة النفاذ الوطني الموحد لأغراض التطوير والعرض، ولا يتصل بالخدمة الفعلية.
      </Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {challenge ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface-muted px-6 py-8 text-center">
          <p className="text-sm text-ink-muted">اختر الرقم التالي في تطبيق نفاذ لتأكيد الدخول</p>
          <p className="font-display text-5xl font-semibold text-primary" aria-live="polite">
            {toArabicDigits(challenge.code)}
          </p>
          <Button size="lg" onClick={approve} disabled={pending} className="w-full">
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            محاكاة الموافقة في التطبيق
          </Button>
        </div>
      ) : (
        <form onSubmit={start} className="flex flex-col gap-4" noValidate>
          <Field id="nationalId" label="رقم الهوية الوطنية أو الإقامة" required>
            <Input id="nationalId" name="nationalId" inputMode="numeric" dir="ltr" maxLength={10} required autoFocus />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Fingerprint aria-hidden="true" />}
            متابعة
          </Button>
        </form>
      )}

      <Button variant="ghost" onClick={onCancel}>
        العودة إلى الدخول باسم المستخدم
      </Button>
    </div>
  );
}
