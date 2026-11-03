"use client";

import { Archive, ArchiveRestore, CirclePause, CirclePlay, PenLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { StatusText } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { createRequestTypeAction, setRequestTypeActiveAction, setRequestTypeArchivedAction, updateRequestTypeAction } from "@/server/actions/admin/taxonomy";

export type RequestTypeItem = { id: string; name: string; description: string | null; isActive: boolean; archivedAt: Date | null; requests: number };

/** «نوع طلب جديد»: name and a short description shown to the association. */
export function NewRequestTypeButton() {
  return (
    <FormDialog
      trigger={
        <>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          نوع طلب جديد
        </>
      }
      triggerVariant="primary"
      triggerSize="sm"
      title="نوع طلب جديد"
      description="يظهر للجمعيات عند تقديم طلب جديد، بعد الأنواع الحالية."
      submitLabel="إضافة نوع الطلب"
      wide
      action={createRequestTypeAction}
    >
      {(e) => <RequestTypeFields prefix="new" error={e} />}
    </FormDialog>
  );
}

function RequestTypeFields({ prefix, error, type }: { prefix: string; error: Record<string, string | undefined>; type?: RequestTypeItem }) {
  return (
    <>
      <Field id={`${prefix}-name`} label="اسم نوع الطلب" hint="مثال: اعتماد مشروع/برنامج." error={error.name} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={type?.name ?? ""} aria-invalid={Boolean(error.name)} />
      </Field>
      <Field id={`${prefix}-desc`} label="الوصف" hint="اختياري؛ جملة قصيرة تشرح للجمعية متى تختار هذا النوع." error={error.description}>
        <Textarea id={`${prefix}-desc`} name="description" defaultValue={type?.description ?? ""} aria-invalid={Boolean(error.description)} />
      </Field>
    </>
  );
}

/**
 * «أنواع الطلبات» (D-123): each type with its description, state and the number of requests that use
 * it. The super admin edits, pauses (no longer offered for new requests) and archives or restores.
 */
export function RequestTypesList({ types }: { types: RequestTypeItem[] }) {
  const router = useRouter();
  return (
    <ol className="flex flex-col">
      {types.map((t, i) => {
        const archived = Boolean(t.archivedAt);
        return (
          <li key={t.id} className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-t border-line px-6 py-5 first:border-0 md:grid-cols-[2.5rem_minmax(0,1fr)_auto]", archived && "bg-surface-muted/60")}>
            <span className={cn("t-figure text-2xl font-bold", archived ? "text-ink-subtle" : "text-accent-ink")}>{toArabicDigits(i + 1)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn("text-base font-bold leading-relaxed", archived ? "text-ink-muted" : "text-ink")}>{t.name}</p>
                {archived ? <StatusText tone="neutral">مؤرشف</StatusText> : t.isActive ? <StatusText tone="ok">نشط</StatusText> : <StatusText tone="warn">موقوف</StatusText>}
              </div>
              {t.description ? <p className="t-body mt-1 text-sm">{t.description}</p> : null}
              <p className="t-caption mt-2">{t.requests ? `${formatNumber(t.requests)} طلب بهذا النوع` : "لا توجد طلبات بهذا النوع بعد"}</p>
            </div>
            <div className="col-span-2 flex flex-wrap items-start gap-2 md:col-span-1 md:flex-col md:items-stretch">
              {archived ? null : (
                <>
                  <FormDialog
                    trigger={
                      <>
                        <PenLine aria-hidden="true" strokeWidth={1.75} />
                        تعديل
                      </>
                    }
                    triggerSize="sm"
                    title={`تعديل «${t.name}»`}
                    submitLabel="حفظ"
                    wide
                    action={updateRequestTypeAction.bind(null, t.id)}
                  >
                    {(e) => <RequestTypeFields prefix={`type-${t.id}`} error={e} type={t} />}
                  </FormDialog>
                  <ConfirmDialog
                    trigger={
                      t.isActive ? (
                        <>
                          <CirclePause aria-hidden="true" strokeWidth={1.75} />
                          إيقاف
                        </>
                      ) : (
                        <>
                          <CirclePlay aria-hidden="true" strokeWidth={1.75} />
                          تفعيل
                        </>
                      )
                    }
                    triggerSize="sm"
                    title={t.isActive ? "إيقاف نوع الطلب" : "تفعيل نوع الطلب"}
                    description={
                      t.isActive
                        ? `لا يُعرض «${t.name}» للجمعيات في الطلبات الجديدة، وتبقى الطلبات المقدَّمة به كما هي.`
                        : `يُعرض «${t.name}» للجمعيات من جديد عند تقديم الطلبات.`
                    }
                    confirmLabel={t.isActive ? "إيقاف" : "تفعيل"}
                    onConfirm={async () => {
                      await setRequestTypeActiveAction(t.id, !t.isActive);
                      router.refresh();
                    }}
                  />
                </>
              )}
              <ConfirmDialog
                trigger={
                  archived ? (
                    <>
                      <ArchiveRestore aria-hidden="true" strokeWidth={1.75} />
                      استعادة
                    </>
                  ) : (
                    <>
                      <Archive aria-hidden="true" strokeWidth={1.75} />
                      أرشفة
                    </>
                  )
                }
                triggerSize="sm"
                title={archived ? "استعادة نوع الطلب" : "أرشفة نوع الطلب"}
                description={archived ? `يعود «${t.name}» إلى القائمة.` : `يختفي «${t.name}» من القائمة ومن الطلبات الجديدة، وتبقى الطلبات المقدَّمة به كما هي.`}
                confirmLabel={archived ? "استعادة" : "أرشفة"}
                onConfirm={async () => {
                  await setRequestTypeArchivedAction(t.id, !archived);
                  router.refresh();
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
