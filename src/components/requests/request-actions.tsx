"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/surface";
import { discardDraftAction } from "@/server/actions/requests";

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
          if (r.ok) router.replace("/association/requests");
          else setError(r.message ?? "تعذّر حذف المسودة.");
          return r.ok ? { ok: true, message: "حُذفت المسودة وملفاتها" } : r;
        }}
      />
      {error ? <FormError>{error}</FormError> : null}
    </div>
  );
}
