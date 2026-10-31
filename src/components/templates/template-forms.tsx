"use client";

import { Archive, ArchiveRestore, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { toArabicDigits } from "@/lib/format";
import { TEMPLATE_KIND_LABEL, TEMPLATE_KINDS, type TemplateKindKey } from "@/lib/validation/templates";
import type { AdminFormState } from "@/server/actions/admin/state";
import { replaceTemplateFileAction, setTemplateArchivedAction, setTemplatePublishedAction } from "@/server/actions/admin/templates";
import { FileUploader } from "./file-uploader";

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
export type ProgramOption = { id: string; number: number; name: string; initiatives: { id: string; number: number; name: string }[] };
export type TemplateDefaults = { kind: TemplateKindKey; title: string; description: string; programId: string; initiativeId: string; attachmentTypeId: string };

/** Metadata (and, when creating, the file). The initiative list follows the chosen program. */
export function TemplateForm({
  mode,
  action,
  defaults,
  programs,
  attachmentTypes,
  accept,
  maxMb,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: TemplateDefaults;
  programs: ProgramOption[];
  attachmentTypes: { id: string; name: string }[];
  accept: string;
  maxMb: number;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  const [programId, setProgramId] = useState(defaults.programId);
  const router = useRouter();
  const e = state.errors ?? {};
  useEffect(() => {
    if (mode === "create" && state.ok && state.createdId) router.replace(`/admin/taxonomy/templates/${state.createdId}`);
  }, [state, mode, router]);
  const initiatives = programs.find((p) => p.id === programId)?.initiatives ?? [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field id="tpl-kind" label="النوع" hint="الدليل للاطلاع، والنموذج يُعبأ ويُرفق بالطلب." error={e.kind} required>
        <Select id="tpl-kind" name="kind" defaultValue={defaults.kind} options={TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND_LABEL[k] }))} />
      </Field>
      <Field id="tpl-title" label="عنوان النموذج" error={e.title} required>
        <Input id="tpl-title" name="title" defaultValue={defaults.title} aria-invalid={Boolean(e.title)} />
      </Field>
      <Field id="tpl-description" label="الوصف" hint="اختياري؛ متى يُستخدم النموذج وكيف يُعبأ." error={e.description}>
        <Textarea id="tpl-description" name="description" defaultValue={defaults.description} aria-invalid={Boolean(e.description)} />
      </Field>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field id="tpl-program" label="البرنامج" hint="اختياري." error={e.programId}>
          <Select
            id="tpl-program"
            name="programId"
            value={programId}
            onChange={(ev) => setProgramId(ev.target.value)}
            placeholder="جميع البرامج"
            options={programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` }))}
          />
        </Field>
        <Field id="tpl-initiative" label="المبادرة" hint={programId ? "اختياري." : "اختر البرنامج أولًا لعرض مبادراته."} error={e.initiativeId}>
          <Select
            id="tpl-initiative"
            name="initiativeId"
            key={programId}
            defaultValue={programId === defaults.programId ? defaults.initiativeId : ""}
            disabled={!programId}
            placeholder="جميع المبادرات"
            options={initiatives.map((i) => ({ value: i.id, label: `${toArabicDigits(i.number)}. ${i.name}` }))}
          />
        </Field>
        <Field id="tpl-type" label="نوع المرفق" hint="اختياري؛ المستند الذي يُعبأ هذا النموذج لأجله." error={e.attachmentTypeId}>
          <Select id="tpl-type" name="attachmentTypeId" defaultValue={defaults.attachmentTypeId} placeholder="بلا نوع محدد" options={attachmentTypes.map((t) => ({ value: t.id, label: t.name }))} />
        </Field>
      </div>
      {mode === "create" ? <FileUploader accept={accept} maxMb={maxMb} error={e.file} label="ملف النموذج" /> : null}
      {mode === "create" ? <p className="t-caption">يُضاف النموذج غير منشور، ثم تنشره من صفحته ليظهر للجمعيات والفريق.</p> : null}
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          {mode === "create" ? "إضافة النموذج" : "حفظ البيانات"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Replaces the current file; the previous version stays in the history. */
export function ReplaceFileForm({ templateId, accept, maxMb }: { templateId: string; accept: string; maxMb: number }) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(replaceTemplateFileAction.bind(null, templateId), {});
  // A staged upload is single use: after a successful replacement the uploader starts empty again.
  const [seen, setSeen] = useState(state);
  const [round, setRound] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setRound((r) => r + 1);
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <FileUploader key={round} accept={accept} maxMb={maxMb} error={state.errors?.file} label="الملف الجديد" />
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الاستبدال…">
          استبدال الملف
        </SubmitButton>
      </div>
    </form>
  );
}

/** Publish/unpublish and archive/restore with confirmation. */
export function TemplateStateActions({ id, title, published, archived }: { id: string; title: string; published: boolean; archived: boolean }) {
  const [result, setResult] = useState<AdminFormState | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {result?.message ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        {archived ? null : published ? (
          <ConfirmDialog
            trigger={
              <>
                <EyeOff aria-hidden="true" strokeWidth={1.75} />
                إلغاء النشر
              </>
            }
            title="إلغاء نشر النموذج"
            description={<>يختفي «{title}» من قوائم الجمعيات والفريق، ولا يُنزَّل إلا لمدير النظام.</>}
            confirmLabel="إلغاء النشر"
            onConfirm={async () => setResult(await setTemplatePublishedAction(id, false))}
          />
        ) : (
          <ConfirmDialog
            trigger={
              <>
                <Eye aria-hidden="true" strokeWidth={1.75} />
                نشر النموذج
              </>
            }
            triggerVariant="primary"
            title="نشر النموذج"
            description={<>يظهر «{title}» لكل من يسجل الدخول: مسؤولو الجمعيات والمشرفون ومدير الوحدة، ويستطيعون تنزيله.</>}
            confirmLabel="نشر"
            onConfirm={async () => setResult(await setTemplatePublishedAction(id, true))}
          />
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
          title={archived ? "استعادة النموذج" : "أرشفة النموذج"}
          description={archived ? <>يعود «{title}» غير منشور، ثم تنشره متى شئت.</> : <>يُلغى نشر «{title}» ويُنقل إلى المؤرشفات. لا يُحذف ملفه ولا سجل إصداراته.</>}
          confirmLabel={archived ? "استعادة" : "أرشفة"}
          confirmVariant={archived ? "primary" : "danger"}
          onConfirm={async () => setResult(await setTemplateArchivedAction(id, !archived))}
        />
      </div>
    </div>
  );
}
