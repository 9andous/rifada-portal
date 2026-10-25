"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Alert } from "./surface";

/**
 * Shows a temporary password exactly once (D-034). The value comes from the server action's
 * response and lives only in the calling component's state; nothing is stored, logged or put in a
 * URL. Leaving or refreshing the page discards it.
 */
export function OneTimeSecret({ username, password, title }: { username: string; password: string; title: string }) {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Alert tone="warning" icon={<KeyRound strokeWidth={1.75} />} title={title}>
      <p>انسخ كلمة المرور المؤقتة الآن وسلّمها لصاحب الحساب بطريقة آمنة. لن تظهر مرة أخرى، ولا تُحفظ في النظام إلا بصيغة مشفرة.</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
        <dt className="t-label">اسم المستخدم</dt>
        <dd>
          <bdi dir="ltr" className="font-semibold text-ink">
            {username}
          </bdi>
        </dd>
        <dt className="t-label">كلمة المرور المؤقتة</dt>
        <dd className="flex flex-wrap items-center gap-3">
          <bdi dir="ltr" data-testid="one-time-password" className="select-all rounded-sm border border-line-strong bg-surface-muted px-3 py-1.5 font-mono text-base tracking-wider text-ink">
            {password}
          </bdi>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied === "done" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied === "done" ? "نُسخت" : "نسخ كلمة المرور"}
          </Button>
        </dd>
      </dl>
      {copied === "failed" ? <p className="mt-2 text-st-bad">تعذّر النسخ تلقائيًا؛ حدّد كلمة المرور وانسخها يدويًا.</p> : null}
      <p className="mt-3 t-caption">سيُطلب من صاحب الحساب تعيين كلمة مرور جديدة عند أول تسجيل دخول.</p>
    </Alert>
  );
}
