"use client";

import { PenLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/states/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Select } from "@/components/ui/select";
import { Alert, SectionTitle, StatusText } from "@/components/ui/surface";
import { arabicList, toArabicDigits } from "@/lib/format";
import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldTypeValue } from "@/lib/validation/taxonomy";
import { UPLOAD_GROUP_LABELS, type UploadGroup } from "@/lib/validation/settings";
import {
  createAttachmentRequirementAction,
  createFieldRequirementAction,
  moveRequirementAction,
  removeRequirementAction,
  updateAttachmentRequirementAction,
  updateFieldRequirementAction,
} from "@/server/actions/admin/requirements";
import type { AdminFormState } from "@/server/actions/admin/state";
import type { RequirementView } from "@/server/services/admin/requirements";
import { CopyRequirementsDialog, type PickerProgram } from "./copy-requirements-dialog";
import { MoveButtons } from "./move-buttons";

type Errors = Record<string, string | undefined>;
type AttachmentTypeOption = { id: string; name: string; allowedMimeGroups: string[] };

function RequiredCheckbox({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" name="isRequired" defaultChecked={defaultChecked} className="size-4 accent-[var(--primary)]" />
      إلزامي عند تقديم الطلب
    </label>
  );
}

/** Field requirement inputs. The key is typed once at creation and shown read-only afterwards (D-051). */
function FieldInputs({ errors: e, current }: { errors: Errors; current?: RequirementView }) {
  const [type, setType] = useState<FieldTypeValue>(current?.fieldType ?? "TEXT");
  return (
    <>
      {current ? (
        <div>
          <p className="t-label">المفتاح</p>
          <p className="mt-1 text-sm">
            <bdi dir="ltr" className="font-mono">
              {current.key}
            </bdi>
            <span className="t-caption ms-2">لا يتغير بعد الإنشاء.</span>
          </p>
        </div>
      ) : (
        <Field id="req-key" label="المفتاح" hint="معرّف ثابت بأحرف لاتينية صغيرة وأرقام و _، مثل trainees_count. لا يمكن تغييره بعد الحفظ." error={e.key} required>
          <Input id="req-key" name="key" dir="ltr" autoComplete="off" aria-invalid={Boolean(e.key)} />
        </Field>
      )}
      <Field id="req-label" label="عنوان الحقل" hint="كما يظهر للجمعية في نموذج الطلب." error={e.label} required>
        <Input id="req-label" name="label" defaultValue={current?.label} aria-invalid={Boolean(e.label)} />
      </Field>
      <Field id="req-type" label="نوع الحقل" error={e.fieldType} required>
        <Select
          id="req-type"
          name="fieldType"
          value={type}
          onChange={(ev) => setType(ev.target.value as FieldTypeValue)}
          options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
        />
      </Field>
      {type === "SELECT" ? (
        <Field id="req-options" label="خيارات القائمة" hint="خيار في كل سطر، دون تكرار." error={e.options} required>
          <Textarea id="req-options" name="options" defaultValue={current?.options.join("\n")} aria-invalid={Boolean(e.options)} />
        </Field>
      ) : null}
      <RequiredCheckbox defaultChecked={current?.isRequired ?? true} />
    </>
  );
}

function RowActions({ r, index, count, readOnly }: { r: RequirementView; index: number; count: number; readOnly: boolean }) {
  const [result, setResult] = useState<AdminFormState | null>(null);
  if (readOnly) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      <MoveButtons id={r.id} label={`«${r.label}»`} first={index === 0} last={index === count - 1} move={moveRequirementAction} />
      {r.kind === "FIELD" ? (
        <FormDialog
          trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerLabel={`تعديل «${r.label}»`}
          title="تعديل الحقل"
          submitLabel="حفظ"
          action={updateFieldRequirementAction.bind(null, r.id)}
        >
          {(errors) => <FieldInputs errors={errors} current={r} />}
        </FormDialog>
      ) : (
        <FormDialog
          trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerLabel={`تعديل «${r.label}»`}
          title={`تعديل «${r.label}»`}
          description="نوع المرفق ثابت؛ لتغييره احذف هذا المتطلب وأضف نوعًا آخر."
          submitLabel="حفظ"
          action={updateAttachmentRequirementAction.bind(null, r.id)}
        >
          {() => <RequiredCheckbox defaultChecked={r.isRequired} />}
        </FormDialog>
      )}
      <ConfirmDialog
        trigger={<Trash2 aria-hidden="true" strokeWidth={1.75} />}
        triggerVariant="ghost"
        triggerSize="sm"
        triggerLabel={`حذف «${r.label}»`}
        title="حذف المتطلب"
        description={
          <>
            يُحذف «{r.label}» من متطلبات هذه المبادرة. الطلبات المقدمة سابقًا تحتفظ بقيمها كما هي، ويُسجَّل الحذف في سجل التدقيق.
          </>
        }
        confirmLabel="حذف المتطلب"
        confirmVariant="danger"
        onConfirm={async () => setResult(await removeRequirementAction(r.id))}
      />
      {result && !result.ok ? <span className="text-xs text-st-bad">{result.message}</span> : null}
    </div>
  );
}

export function RequirementsEditor({
  initiativeId,
  fields,
  attachments,
  activeTypes,
  allowedGroups,
  programs,
  readOnly,
  readOnlyReason = "archived",
}: {
  initiativeId: string;
  fields: RequirementView[];
  attachments: RequirementView[];
  activeTypes: AttachmentTypeOption[];
  /** `uploads.allowedGroups` from the settings; a type's groups outside it are flagged. */
  allowedGroups: string[];
  programs: PickerProgram[];
  /** Archived initiatives (and the manager's view) are shown without editing controls. */
  readOnly: boolean;
  readOnlyReason?: "archived" | "view";
}) {
  const usedTypes = new Set(attachments.map((a) => a.attachmentType?.id));
  const freeTypes = activeTypes.filter((t) => !usedTypes.has(t.id));

  return (
    <div className="flex flex-col gap-8">
      {readOnly && readOnlyReason === "archived" ? <Alert tone="warning">المبادرة مؤرشفة؛ تُعرض متطلباتها للاطلاع فقط. استعدها لتعديلها.</Alert> : null}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle as="h3" className="text-[0.9375rem]">
            الحقول الخاصة بالمبادرة
          </SectionTitle>
          {readOnly ? null : (
            <FormDialog
              trigger={
                <>
                  <Plus aria-hidden="true" strokeWidth={1.75} />
                  حقل جديد
                </>
              }
              triggerVariant="primary"
              title="حقل جديد"
              description="يظهر الحقل للجمعية بعد الحقول العامة للطلب."
              submitLabel="إضافة الحقل"
              action={createFieldRequirementAction.bind(null, initiativeId)}
            >
              {(errors) => <FieldInputs errors={errors} />}
            </FormDialog>
          )}
        </div>
        {fields.length === 0 ? (
          <EmptyState variant="inline" title="لا توجد حقول خاصة" description="يكتفي الطلب بالحقول العامة ما لم تُضف حقول هنا." />
        ) : (
          <RequirementTable rows={fields} readOnly={readOnly} kind="FIELD" />
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle as="h3" className="text-[0.9375rem]">
            المرفقات المطلوبة
          </SectionTitle>
          {readOnly ? null : (
            <FormDialog
              trigger={
                <>
                  <Plus aria-hidden="true" strokeWidth={1.75} />
                  مرفق مطلوب
                </>
              }
              triggerVariant="primary"
              title="مرفق مطلوب"
              description={freeTypes.length === 0 ? "كل أنواع المرفقات النشطة مطلوبة بالفعل في هذه المبادرة." : "اختر نوع المرفق من أنواع المرفقات النشطة."}
              submitLabel="إضافة"
              action={createAttachmentRequirementAction.bind(null, initiativeId)}
            >
              {(errors) => (
                <>
                  <Field id="req-attachment-type" label="نوع المرفق" error={errors.attachmentTypeId} required>
                    <Select
                      id="req-attachment-type"
                      name="attachmentTypeId"
                      placeholder="اختر نوع المرفق"
                      options={freeTypes.map((t) => ({ value: t.id, label: t.name }))}
                      aria-invalid={Boolean(errors.attachmentTypeId)}
                    />
                  </Field>
                  <RequiredCheckbox />
                </>
              )}
            </FormDialog>
          )}
        </div>
        {attachments.length === 0 ? (
          <EmptyState variant="inline" title="لا توجد مرفقات مطلوبة" />
        ) : (
          <RequirementTable rows={attachments} readOnly={readOnly} kind="ATTACHMENT" allowedGroups={allowedGroups} />
        )}
      </section>

      {readOnly ? null : (
        <section className="border-t border-line pt-6">
          <SectionTitle as="h3" className="text-[0.9375rem]">
            نسخ المتطلبات
          </SectionTitle>
          <p className="t-body mt-1 ps-4 text-sm">
            تُستبدل متطلبات المبادرات المختارة بالكامل بمتطلبات هذه المبادرة. تظهر معاينة بما سيُحذف ويُستبدل ويُضاف قبل التأكيد.
          </p>
          <div className="mt-4 ps-4">
            <CopyRequirementsDialog sourceId={initiativeId} programs={programs} sourceCount={fields.length + attachments.length} />
          </div>
        </section>
      )}
    </div>
  );
}

function RequirementTable({ rows, readOnly, kind, allowedGroups = [] }: { rows: RequirementView[]; readOnly: boolean; kind: "FIELD" | "ATTACHMENT"; allowedGroups?: string[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="t-table w-full min-w-[40rem] border-collapse">
        <caption className="sr-only">{kind === "FIELD" ? "الحقول الخاصة بالمبادرة" : "المرفقات المطلوبة"}</caption>
        <thead className="bg-surface-muted">
          <tr>
            <th scope="col" className="t-label w-10 py-2.5 ps-4 text-start">
              #
            </th>
            <th scope="col" className="t-label py-2.5 text-start">
              {kind === "FIELD" ? "الحقل" : "المرفق"}
            </th>
            <th scope="col" className="t-label py-2.5 text-start">
              {kind === "FIELD" ? "النوع" : "الملفات المقبولة"}
            </th>
            <th scope="col" className="t-label w-24 py-2.5 text-start">
              الإلزام
            </th>
            <th scope="col" className="w-40 py-2.5 pe-4">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => {
            const groups = (r.attachmentType?.allowedMimeGroups ?? []) as UploadGroup[];
            const blocked = groups.filter((g) => !allowedGroups.includes(g));
            return (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="t-figure py-3 ps-4 align-top text-ink-subtle">{toArabicDigits(index + 1)}</td>
                <td className="py-3 pe-4 align-top">
                  <span className="text-ink">{r.label}</span>
                  <span className="t-caption mt-0.5 block">
                    <bdi dir="ltr" className="font-mono">
                      {r.key}
                    </bdi>
                  </span>
                  {r.attachmentType?.archivedAt ? <StatusText tone="neutral" className="mt-1 text-xs">نوع المرفق مؤرشف</StatusText> : null}
                </td>
                <td className="py-3 pe-4 align-top text-sm">
                  {kind === "FIELD" ? (
                    <>
                      {r.fieldType ? FIELD_TYPE_LABELS[r.fieldType] : "—"}
                      {r.fieldType === "SELECT" ? <span className="t-caption mt-0.5 block">{r.options.join("، ")}</span> : null}
                    </>
                  ) : (
                    <>
                      {arabicList(groups.map((g) => UPLOAD_GROUP_LABELS[g] ?? g))}
                      {blocked.length > 0 ? (
                        <span className="t-caption mt-0.5 block text-st-warn">غير مسموح حاليًا في الإعدادات: {arabicList(blocked.map((g) => UPLOAD_GROUP_LABELS[g] ?? g))}</span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="py-3 pe-4 align-top">
                  <StatusText tone={r.isRequired ? "info" : "neutral"}>{r.isRequired ? "إلزامي" : "اختياري"}</StatusText>
                </td>
                <td className="py-1.5 pe-4 align-top">
                  <RowActions r={r} index={index} count={rows.length} readOnly={readOnly} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
