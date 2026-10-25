"use client";

import { Archive, ArchiveRestore, CirclePause, CirclePlay } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/surface";
import { formatNumber } from "@/lib/format";
import type { AdminFormState } from "@/server/actions/admin/state";

type Noun = "program" | "initiative";

const COPY: Record<Noun, { name: string; pause: string; resume: string; archive: string; restore: string }> = {
  program: { name: "البرنامج", pause: "إيقاف البرنامج", resume: "إعادة تشغيل البرنامج", archive: "أرشفة البرنامج", restore: "استعادة البرنامج" },
  initiative: { name: "المبادرة", pause: "إيقاف المبادرة", resume: "إعادة تشغيل المبادرة", archive: "أرشفة المبادرة", restore: "استعادة المبادرة" },
};

/**
 * Pause/resume and archive/restore with a centred confirmation. For a program the dialog states how
 * many initiatives are hidden with it (derived effect; their own flags do not change, D-052).
 */
export function StateActions({
  noun,
  id,
  name,
  isActive,
  archived,
  affectedInitiatives,
  setActive,
  setArchived,
}: {
  noun: Noun;
  id: string;
  name: string;
  isActive: boolean;
  archived: boolean;
  affectedInitiatives?: number;
  setActive: (id: string, active: boolean) => Promise<AdminFormState>;
  setArchived: (id: string, archived: boolean) => Promise<AdminFormState>;
}) {
  const [result, setResult] = useState<AdminFormState | null>(null);
  const c = COPY[noun];
  const affected =
    noun === "program" && affectedInitiatives !== undefined
      ? ` ستُخفى معه مبادراته (${formatNumber(affectedInitiatives)}) من نموذج الطلب والصفحات العامة دون تغيير حالتها، وتعود بعودته.`
      : "";

  return (
    <div className="flex flex-col gap-4">
      {result?.message ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        {!archived ? (
          isActive ? (
            <ConfirmDialog
              trigger={
                <>
                  <CirclePause aria-hidden="true" strokeWidth={1.75} />
                  {c.pause}
                </>
              }
              title={c.pause}
              description={
                <>
                  يبقى «{name}» ظاهرًا في المحرر وفي الطلبات القائمة، ولا تُقبل عليه طلبات جديدة.{affected}
                </>
              }
              confirmLabel={c.pause}
              onConfirm={async () => setResult(await setActive(id, false))}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <>
                  <CirclePlay aria-hidden="true" strokeWidth={1.75} />
                  {c.resume}
                </>
              }
              title={c.resume}
              description={<>يعود «{name}» متاحًا لتقديم الطلبات الجديدة.</>}
              confirmLabel={c.resume}
              onConfirm={async () => setResult(await setActive(id, true))}
            />
          )
        ) : null}
        {archived ? (
          <ConfirmDialog
            trigger={
              <>
                <ArchiveRestore aria-hidden="true" strokeWidth={1.75} />
                {c.restore}
              </>
            }
            title={c.restore}
            description={<>يعود «{name}» إلى القوائم بحالته السابقة.</>}
            confirmLabel={c.restore}
            onConfirm={async () => setResult(await setArchived(id, false))}
          />
        ) : (
          <ConfirmDialog
            trigger={
              <>
                <Archive aria-hidden="true" strokeWidth={1.75} />
                {c.archive}
              </>
            }
            title={c.archive}
            description={
              <>
                يُنقل «{name}» إلى المؤرشفات: يختفي من نموذج الطلب والصفحات العامة، ولا يُحذف، ويمكن استعادته في أي وقت.{affected}
              </>
            }
            confirmLabel={c.archive}
            confirmVariant="danger"
            onConfirm={async () => setResult(await setArchived(id, true))}
          />
        )}
      </div>
    </div>
  );
}
