"use client";

import { Trash2, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/surface";
import { discardDraftAction } from "@/server/actions/requests";
import { ReassignDialog, type DialogRequest, type SupervisorChoice } from "./decision-dialog";

/** «حذف المسودة»: only for a draft that was never submitted (D-073). */
export function DiscardDraftButton({ requestId, title }: { requestId: string; title: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        trigger={
          <>
            <Trash2 aria-hidden="true" strokeWidth={1.75} />
            حذف المسودة
          </>
        }
        triggerVariant="ghost"
        title="حذف المسودة"
        description={<>تُحذف المسودة «{title || "بلا عنوان"}» وجميع ملفاتها نهائيًا، ولا يمكن استعادتها.</>}
        confirmLabel="حذف المسودة"
        confirmVariant="danger"
        onConfirm={async () => {
          const r = await discardDraftAction(requestId);
          if (r.ok) router.replace("/association/requests?discarded=1");
          else setError(r.message ?? "تعذّر حذف المسودة.");
        }}
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

/** Unit manager: «إعادة الإسناد» for one request. */
export function ReassignButton({ request, supervisors }: { request: DialogRequest; supervisors: SupervisorChoice[] }) {
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
      >
        <UserRoundCog aria-hidden="true" strokeWidth={1.75} />
        إعادة الإسناد
      </Button>
      {open ? <ReassignDialog key={round} open onOpenChange={setOpen} requests={[request]} supervisors={supervisors} onDone={() => router.refresh()} /> : null}
    </>
  );
}
