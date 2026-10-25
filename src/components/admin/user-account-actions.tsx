"use client";

import { KeyRound, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import { Alert } from "@/components/ui/surface";
import { resetUserPasswordAction, setUserActiveAction } from "@/server/actions/admin/users";
import type { AdminFormState } from "@/server/actions/admin/state";

/** Deactivate / reactivate and reset-password controls on the user page. The server re-checks every rule. */
export function UserAccountActions({
  userId,
  name,
  isActive,
  isSelf,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [result, setResult] = useState<AdminFormState | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {result?.credentials ? (
        <OneTimeSecret title="أُصدرت كلمة مرور مؤقتة جديدة" username={result.credentials.username} password={result.credentials.password} />
      ) : result?.message ? (
        <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>
      ) : null}

      {isSelf ? (
        <p className="t-caption">لا يمكنك تعطيل حسابك أو إعادة تعيين كلمة مروره من هنا.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <ConfirmDialog
            trigger={
              <>
                <KeyRound aria-hidden="true" strokeWidth={1.75} />
                إصدار كلمة مرور مؤقتة
              </>
            }
            title="إصدار كلمة مرور مؤقتة"
            description={
              <>
                ستُستبدل كلمة مرور «{name}» بكلمة مؤقتة تظهر لك مرة واحدة، وتُنهى جميع جلساته، ويُطلب منه تعيين كلمة جديدة عند الدخول.
              </>
            }
            confirmLabel="إصدار كلمة المرور"
            onConfirm={async () => setResult(await resetUserPasswordAction(userId))}
          />
          {isActive ? (
            <ConfirmDialog
              trigger={
                <>
                  <UserX aria-hidden="true" strokeWidth={1.75} />
                  تعطيل الحساب
                </>
              }
              title="تعطيل الحساب"
              description={<>لن يتمكن «{name}» من تسجيل الدخول، وتُنهى جميع جلساته الحالية فورًا. يمكنك إعادة تفعيله لاحقًا.</>}
              confirmLabel="تعطيل الحساب"
              confirmVariant="danger"
              onConfirm={async () => setResult(await setUserActiveAction(userId, false))}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <>
                  <UserCheck aria-hidden="true" strokeWidth={1.75} />
                  تفعيل الحساب
                </>
              }
              title="تفعيل الحساب"
              description={<>سيتمكن «{name}» من تسجيل الدخول مجددًا بكلمة مروره الحالية.</>}
              confirmLabel="تفعيل الحساب"
              onConfirm={async () => setResult(await setUserActiveAction(userId, true))}
            />
          )}
        </div>
      )}
    </div>
  );
}
