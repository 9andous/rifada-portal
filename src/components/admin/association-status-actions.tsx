"use client";

import { Ban, CircleCheck } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/surface";
import { setAssociationActiveAction } from "@/server/actions/admin/associations";
import type { AdminFormState } from "@/server/actions/admin/state";

export function AssociationStatusActions({
  associationId,
  name,
  isActive,
  hasActiveOfficer,
  hasOfficer,
}: {
  associationId: string;
  name: string;
  isActive: boolean;
  hasActiveOfficer: boolean;
  hasOfficer: boolean;
}) {
  const [result, setResult] = useState<AdminFormState | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {result?.message ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
      {isActive ? (
        <ConfirmDialog
          trigger={
            <>
              <Ban aria-hidden="true" strokeWidth={1.75} />
              تعطيل الجمعية
            </>
          }
          title="تعطيل الجمعية"
          description={
            <>
              ستُعطَّل «{name}».
              {hasActiveOfficer ? " ويُعطَّل معها حساب مسؤولها وتُنهى جلساته فورًا، فلا يتمكن من تسجيل الدخول." : ""} يمكنك إعادة تفعيلها لاحقًا.
            </>
          }
          confirmLabel="تعطيل الجمعية"
          confirmVariant="danger"
          onConfirm={async () => setResult(await setAssociationActiveAction(associationId, false))}
        />
      ) : (
        <ConfirmDialog
          trigger={
            <>
              <CircleCheck aria-hidden="true" strokeWidth={1.75} />
              تفعيل الجمعية
            </>
          }
          title="تفعيل الجمعية"
          description={<>ستُفعَّل «{name}».{hasOfficer ? " يبقى حساب مسؤولها معطلًا حتى تفعّله من صفحة المستخدم." : ""}</>}
          confirmLabel="تفعيل الجمعية"
          onConfirm={async () => setResult(await setAssociationActiveAction(associationId, true))}
        />
      )}
    </div>
  );
}
