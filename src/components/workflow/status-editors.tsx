"use client";

import { PenLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoveButtons } from "@/components/taxonomy/move-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Select } from "@/components/ui/select";
import { Alert, StatusText, type StatusTone } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";
import { STATUS_TONE_LABELS, STATUS_TONES, TRANSITION_ROLES } from "@/lib/workflow";
import { ROLE_LABELS, type Role } from "@/server/authz/roles";
import { createTransitionAction, moveStatusAction, removeTransitionAction, updateStatusAction, updateTransitionAction } from "@/server/actions/admin/statuses";
import type { AdminFormState } from "@/server/actions/admin/state";

export type StatusItem = { id: string; key: string; name: string; tone: StatusTone; isTerminal: boolean };
export type TransitionItem = { id: string; fromStatusId: string; toStatusId: string; allowedRoles: Role[]; isAutomatic: boolean };

type Errors = Record<string, string | undefined>;

const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-st-neutral",
  info: "bg-st-info",
  review: "bg-st-review",
  warn: "bg-st-warn",
  ok: "bg-st-ok",
  bad: "bg-st-bad",
};

/** The seven statuses: rename, recolour and reorder. Keys and the terminal flag are shown, never edited. */
export function StatusesTable({ statuses, readOnly }: { statuses: StatusItem[]; readOnly: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="t-table w-full min-w-[40rem] border-collapse">
        <caption className="sr-only">حالات الطلب</caption>
        <thead className="bg-surface-muted">
          <tr>
            <th scope="col" className="t-label w-24 py-2.5 ps-6 text-start">
              الترتيب
            </th>
            <th scope="col" className="t-label py-2.5 text-start">
              الحالة
            </th>
            <th scope="col" className="t-label py-2.5 text-start">
              المفتاح
            </th>
            <th scope="col" className="t-label py-2.5 text-start">
              النوع
            </th>
            {readOnly ? null : (
              <th scope="col" className="w-36 py-2.5 pe-6">
                <span className="sr-only">إجراءات</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {statuses.map((s, index) => (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="t-figure py-3 ps-6 text-ink-subtle">{toArabicDigits(index + 1)}</td>
              <td className="py-3 pe-4">
                <StatusText tone={s.tone}>{s.name}</StatusText>
              </td>
              <td className="py-3 pe-4">
                <bdi dir="ltr" className="font-mono text-xs text-ink-muted">
                  {s.key}
                </bdi>
              </td>
              <td className="py-3 pe-4 text-sm text-ink-muted">{s.isTerminal ? "نهائية" : "مرحلية"}</td>
              {readOnly ? null : (
                <td className="py-1.5 pe-6">
                  <div className="flex items-center justify-end gap-1">
                    <MoveButtons id={s.id} label={`«${s.name}»`} first={index === 0} last={index === statuses.length - 1} move={moveStatusAction} />
                    <FormDialog
                      trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      triggerLabel={`تعديل «${s.name}»`}
                      title={`تعديل حالة «${s.name}»`}
                      description="يتغير الاسم واللون في كل مكان تظهر فيه الحالة. المفتاح ونوع الحالة ثابتان."
                      submitLabel="حفظ"
                      action={updateStatusAction.bind(null, s.id)}
                    >
                      {(e) => <StatusFields status={s} errors={e} />}
                    </FormDialog>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusFields({ status, errors: e }: { status: StatusItem; errors: Errors }) {
  return (
    <>
      <Field id={`status-name-${status.id}`} label="الاسم" error={e.name} required>
        <Input id={`status-name-${status.id}`} name="name" defaultValue={status.name} aria-invalid={Boolean(e.name)} />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-ink">اللون</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {STATUS_TONES.map((tone) => (
            <label key={tone} className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-surface-sunken">
              <input type="radio" name="tone" value={tone} defaultChecked={status.tone === tone} className="accent-[var(--primary)]" />
              <span aria-hidden="true" className={cn("size-2.5 rounded-full", TONE_DOT[tone])} />
              {STATUS_TONE_LABELS[tone]}
            </label>
          ))}
        </div>
        {e.tone ? <p className="mt-2 text-xs text-danger">{e.tone}</p> : null}
      </fieldset>
    </>
  );
}

function RolesFields({ errors: e, roles, automatic }: { errors: Errors; roles: Role[]; automatic: boolean }) {
  const [isAutomatic, setAutomatic] = useState(automatic);
  return (
    <>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="isAutomatic" checked={isAutomatic} onChange={(ev) => setAutomatic(ev.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
        <span>
          <span className="font-medium text-ink">انتقال تلقائي</span>
          <span className="t-caption block">ينفذه النظام وحده (مثل فحص الاكتمال)، ولا يستطيع أي مستخدم تنفيذه.</span>
        </span>
      </label>
      {isAutomatic ? null : (
        <fieldset aria-describedby={e.roles ? "roles-error" : undefined}>
          <legend className="text-sm font-medium text-ink">الأدوار التي تنفذ الانتقال</legend>
          <div className="mt-3 flex flex-col gap-2">
            {TRANSITION_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="roles" value={r} defaultChecked={roles.includes(r)} className="size-4 accent-[var(--primary)]" />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
          {e.roles ? (
            <p id="roles-error" role="alert" className="mt-2 text-xs text-danger">
              {e.roles}
            </p>
          ) : null}
        </fieldset>
      )}
    </>
  );
}

/** «من → إلى» with role labels or the automatic mark. */
export function TransitionsTable({ statuses, transitions, readOnly }: { statuses: StatusItem[]; transitions: TransitionItem[]; readOnly: boolean }) {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const [result, setResult] = useState<AdminFormState | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {result?.message ? (
        <Alert tone={result.ok ? "success" : "danger"} className="mx-6">
          {result.message}
        </Alert>
      ) : null}
      <div className="overflow-x-auto">
        <table className="t-table w-full min-w-[44rem] border-collapse">
          <caption className="sr-only">انتقالات الطلب بين الحالات</caption>
          <thead className="bg-surface-muted">
            <tr>
              <th scope="col" className="t-label py-2.5 ps-6 text-start">
                من
              </th>
              <th scope="col" className="t-label py-2.5 text-start">
                إلى
              </th>
              <th scope="col" className="t-label py-2.5 text-start">
                من ينفذه
              </th>
              {readOnly ? null : (
                <th scope="col" className="w-24 py-2.5 pe-6">
                  <span className="sr-only">إجراءات</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {transitions.map((t) => {
              const from = byId.get(t.fromStatusId);
              const to = byId.get(t.toStatusId);
              return (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="py-3 ps-6 pe-4">{from ? <StatusText tone={from.tone}>{from.name}</StatusText> : "—"}</td>
                  <td className="py-3 pe-4">{to ? <StatusText tone={to.tone}>{to.name}</StatusText> : "—"}</td>
                  <td className="py-3 pe-4 text-sm">
                    {t.isAutomatic ? <span className="text-ink-muted">تلقائي — ينفذه النظام</span> : t.allowedRoles.map((r) => ROLE_LABELS[r]).join("، ")}
                  </td>
                  {readOnly ? null : (
                    <td className="py-1.5 pe-6">
                      <div className="flex items-center justify-end gap-1">
                        <FormDialog
                          trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
                          triggerVariant="ghost"
                          triggerSize="sm"
                          triggerLabel={`تعديل الانتقال من «${from?.name}» إلى «${to?.name}»`}
                          title={`الانتقال من «${from?.name}» إلى «${to?.name}»`}
                          description="لتغيير الحالتين احذف هذا الانتقال وأضف انتقالًا جديدًا."
                          submitLabel="حفظ"
                          action={updateTransitionAction.bind(null, t.id)}
                        >
                          {(e) => <RolesFields errors={e} roles={t.allowedRoles} automatic={t.isAutomatic} />}
                        </FormDialog>
                        <ConfirmDialog
                          trigger={<Trash2 aria-hidden="true" strokeWidth={1.75} />}
                          triggerVariant="ghost"
                          triggerSize="sm"
                          triggerLabel={`حذف الانتقال من «${from?.name}» إلى «${to?.name}»`}
                          title="حذف الانتقال"
                          description={
                            <>
                              يُحذف الانتقال من «{from?.name}» إلى «{to?.name}». يُرفض الحذف إذا جعل إحدى الحالات عاجزة عن الوصول إلى حالة نهائية. لا تُحذف الحالات نفسها.
                            </>
                          }
                          confirmLabel="حذف الانتقال"
                          confirmVariant="danger"
                          onConfirm={async () => setResult(await removeTransitionAction(t.id))}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NewTransitionButton({ statuses }: { statuses: StatusItem[] }) {
  const options = statuses.map((s) => ({ value: s.id, label: s.name }));
  return (
    <FormDialog
      trigger={
        <>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          انتقال جديد
        </>
      }
      triggerVariant="primary"
      title="انتقال جديد"
      description="يُحفظ الانتقال إذا بقيت دورة الطلب صحيحة: لا خروج من حالة نهائية، ولا تكرار، وكل حالة تصل إلى حالة نهائية."
      submitLabel="إضافة الانتقال"
      action={createTransitionAction}
    >
      {(e) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="transition-from" label="من الحالة" error={e.fromStatusId} required>
              <Select id="transition-from" name="fromStatusId" placeholder="اختر" options={options.filter((o) => !statuses.find((s) => s.id === o.value)?.isTerminal)} />
            </Field>
            <Field id="transition-to" label="إلى الحالة" error={e.toStatusId} required>
              <Select id="transition-to" name="toStatusId" placeholder="اختر" options={options} />
            </Field>
          </div>
          <RolesFields errors={e} roles={[]} automatic={false} />
        </>
      )}
    </FormDialog>
  );
}

/** The scope note the owner asked for beside the transition editor. */
export function ScopeNote() {
  return (
    <p className="t-caption">
      الأدوار المذكورة لا تعمل إلا على الطلبات الواقعة في نطاقها: المشرف على طلبات البرامج المسندة إليه فقط، ومسؤول الجمعية على طلبات جمعيته فقط، ومدير الوحدة على جميع الطلبات.
    </p>
  );
}
