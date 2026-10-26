"use client";

import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-bits";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { createAssociationOfficerAction } from "@/server/actions/admin/associations";
import type { AdminFormState } from "@/server/actions/admin/state";
import { OfficerFields } from "./officer-fields";

/**
 * «إنشاء حساب مسؤول» for an association without an officer account: the same officer step as in
 * «جمعية جديدة», with this association already chosen. It stays mounted after the page refreshes
 * (when the association then has an officer) so the one-time password remains visible until the
 * admin leaves the page.
 */
export function AssociationOfficerCreator({
  associationId,
  hasOfficer,
  isActive,
}: {
  associationId: string;
  hasOfficer: boolean;
  isActive: boolean;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(createAssociationOfficerAction.bind(null, associationId), {});
  const [open, setOpen] = useState(false);

  if (state.ok && state.credentials) {
    return (
      <Card>
        <OneTimeSecret title="أُنشئ حساب مسؤول الجمعية" username={state.credentials.username} password={state.credentials.password} />
        {state.createdId ? (
          <Link href={`/admin/users/${state.createdId}`} className={buttonClasses("outline", "md", "self-start")}>
            فتح صفحة الحساب
          </Link>
        ) : null}
      </Card>
    );
  }
  if (hasOfficer) return null;
  if (!isActive) {
    return (
      <Card>
        <p className="t-body text-sm">لا يوجد حساب مسؤول لهذه الجمعية. فعّل الجمعية أولًا لإنشاء حسابه.</p>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card>
        <p className="t-body text-sm">لا يوجد حساب مسؤول لهذه الجمعية بعد؛ لن تتمكن الجمعية من الدخول وتقديم طلباتها حتى يُنشأ.</p>
        <Button variant="primary" className="self-start" onClick={() => setOpen(true)}>
          <UserRoundPlus aria-hidden="true" strokeWidth={1.75} />
          إنشاء حساب مسؤول
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <p className="t-caption">لكل جمعية حساب واحد. تظهر كلمة المرور المؤقتة مرة واحدة بعد الحفظ، ويُطلب تغييرها عند أول دخول.</p>
        {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
        <OfficerFields errors={state.errors} />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} pendingLabel="جارٍ الإنشاء…">
            إنشاء الحساب
          </SubmitButton>
          <Button variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <PanelHeader title="حساب مسؤول الجمعية" />
      <div className="flex flex-col gap-4 px-6 pb-6">{children}</div>
    </Panel>
  );
}
