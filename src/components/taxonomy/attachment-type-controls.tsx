"use client";

import { Archive, ArchiveRestore, PenLine, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Alert } from "@/components/ui/surface";
import { UPLOAD_GROUP_LABELS, UPLOAD_GROUPS } from "@/lib/validation/settings";
import { createAttachmentTypeAction, setAttachmentTypeArchivedAction, updateAttachmentTypeAction } from "@/server/actions/admin/attachment-types";
import type { AdminFormState } from "@/server/actions/admin/state";

type Errors = Record<string, string | undefined>;

function GroupBoxes({ errors, checked }: { errors: Errors; checked: string[] }) {
  return (
    <fieldset aria-describedby={errors.groups ? "groups-error" : undefined}>
      <legend className="text-sm font-medium text-ink">الملفات المقبولة</legend>
      <p className="t-caption mt-1">لا تُقبل ملفات الفيديو في أي حال. يُطبَّق عند الرفع ما يسمح به هذا النوع وإعدادات المنصة معًا.</p>
      <div className="mt-3 flex flex-col gap-2">
        {UPLOAD_GROUPS.map((g) => (
          <label key={g} className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="groups" value={g} defaultChecked={checked.includes(g)} className="size-4 accent-[var(--primary)]" />
            {UPLOAD_GROUP_LABELS[g]}
          </label>
        ))}
      </div>
      {errors.groups ? (
        <p id="groups-error" role="alert" className="mt-2 text-xs text-danger">
          {errors.groups}
        </p>
      ) : null}
    </fieldset>
  );
}

export function NewAttachmentTypeButton() {
  return (
    <FormDialog
      trigger={
        <>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          نوع مرفق جديد
        </>
      }
      triggerVariant="onBand"
      title="نوع مرفق جديد"
      submitLabel="إضافة"
      action={createAttachmentTypeAction}
    >
      {(e) => (
        <>
          <Field id="type-key" label="المفتاح" hint="أحرف لاتينية صغيرة وأرقام و _، مثل program_plan. لا يتغير بعد الحفظ." error={e.key} required>
            <Input id="type-key" name="key" dir="ltr" autoComplete="off" aria-invalid={Boolean(e.key)} />
          </Field>
          <Field id="type-name" label="الاسم" error={e.name} required>
            <Input id="type-name" name="name" aria-invalid={Boolean(e.name)} />
          </Field>
          <GroupBoxes errors={e} checked={["pdf"]} />
        </>
      )}
    </FormDialog>
  );
}

export function AttachmentTypeRowActions({ id, typeKey, name, groups, archived }: { id: string; typeKey: string; name: string; groups: string[]; archived: boolean }) {
  const [result, setResult] = useState<AdminFormState | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1">
        <FormDialog
          trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerLabel={`تعديل «${name}»`}
          title={`تعديل «${name}»`}
          submitLabel="حفظ"
          action={updateAttachmentTypeAction.bind(null, id)}
        >
          {(e) => (
            <>
              <div>
                <p className="t-label">المفتاح</p>
                <p className="mt-1 text-sm">
                  <bdi dir="ltr" className="font-mono">
                    {typeKey}
                  </bdi>
                  <span className="t-caption ms-2">لا يتغير بعد الإنشاء.</span>
                </p>
              </div>
              <Field id={`type-name-${id}`} label="الاسم" error={e.name} required>
                <Input id={`type-name-${id}`} name="name" defaultValue={name} aria-invalid={Boolean(e.name)} />
              </Field>
              <GroupBoxes errors={e} checked={groups} />
            </>
          )}
        </FormDialog>
        <ConfirmDialog
          trigger={archived ? <ArchiveRestore aria-hidden="true" strokeWidth={1.75} /> : <Archive aria-hidden="true" strokeWidth={1.75} />}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerLabel={`${archived ? "استعادة" : "أرشفة"} «${name}»`}
          title={archived ? "استعادة نوع المرفق" : "أرشفة نوع المرفق"}
          description={
            archived
              ? `يعود «${name}» متاحًا لمتطلبات المبادرات الجديدة.`
              : `يبقى «${name}» في متطلبات المبادرات التي تستخدمه حاليًا، ولا يُعرض عند إضافة متطلبات جديدة. لا يُحذف.`
          }
          confirmLabel={archived ? "استعادة" : "أرشفة"}
          confirmVariant={archived ? "primary" : "danger"}
          onConfirm={async () => setResult(await setAttachmentTypeArchivedAction(id, !archived))}
        />
      </div>
      {result && !result.ok ? <Alert tone="danger">{result.message}</Alert> : null}
    </div>
  );
}
