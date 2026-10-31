"use client";

import { Archive, ArchiveRestore, Layers, PenLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { StatusText } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { createTrackAction, setTrackArchivedAction, setTrackProgramsAction, updateTrackAction } from "@/server/actions/admin/taxonomy";

type ProgramRef = { id: string; number: number; name: string; archivedAt?: Date | null };
export type TrackRow = { id: string; number: number; name: string; description: string | null; archivedAt: Date | null; programs: ProgramRef[] };

const shortName = (name: string) => name.replace(/^برنامج /, "");

/** «مسار جديد»: name and description; the number follows the last one. */
export function NewTrackButton() {
  return (
    <FormDialog
      trigger={
        <>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          مسار جديد
        </>
      }
      triggerVariant="primary"
      triggerSize="sm"
      title="مسار جديد"
      description="يُرقَّم المسار بعد آخر مسار، ثم تختار برامجه."
      submitLabel="إضافة المسار"
      wide
      action={createTrackAction}
    >
      {(e) => <TrackFields prefix="new" error={e} />}
    </FormDialog>
  );
}

function TrackFields({ prefix, error, track }: { prefix: string; error: Record<string, string | undefined>; track?: TrackRow }) {
  return (
    <>
      <Field id={`${prefix}-name`} label="اسم المسار" error={error.name} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={track?.name ?? ""} aria-invalid={Boolean(error.name)} />
      </Field>
      <Field id={`${prefix}-desc`} label="الوصف" hint="اختياري؛ ما يشمله المسار من أنشطة الجمعيات." error={error.description}>
        <Textarea id={`${prefix}-desc`} name="description" defaultValue={track?.description ?? ""} aria-invalid={Boolean(error.description)} />
      </Field>
    </>
  );
}

/**
 * «المسارات» (D-119): each track with its number, name, description and programmes. The super admin
 * edits the name, chooses the programmes (a programme may sit in several tracks) and archives or
 * restores; the unit manager reads.
 */
export function TracksList({ tracks, programs, readOnly }: { tracks: TrackRow[]; programs: ProgramRef[]; readOnly: boolean }) {
  const router = useRouter();
  return (
    <ol className="flex flex-col">
      {tracks.map((t) => {
        const archived = Boolean(t.archivedAt);
        const open = t.programs.filter((p) => !p.archivedAt);
        return (
          <li key={t.id} className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-t border-line px-6 py-5 first:border-0 md:grid-cols-[2.5rem_minmax(0,1fr)_auto]", archived && "bg-surface-muted/60")}>
            <span className={cn("t-figure text-2xl font-bold", archived ? "text-ink-subtle" : "text-accent-ink")}>{toArabicDigits(t.number)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn("text-base font-bold leading-relaxed", archived ? "text-ink-muted" : "text-ink")}>{t.name}</p>
                {archived ? <StatusText tone="neutral">مؤرشف</StatusText> : null}
              </div>
              {t.description ? <p className="t-body mt-1 text-sm">{t.description}</p> : null}
              <div className="mt-3">
                <p className="t-caption mb-1.5">{open.length ? `البرامج (${formatNumber(open.length)})` : "البرامج"}</p>
                {open.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {open.map((p) => (
                      <li key={p.id} className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-sm text-ink">
                        <span className="t-figure me-1 text-ink-subtle">{toArabicDigits(p.number)}.</span>
                        {shortName(p.name)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-st-warn">لا توجد برامج في هذا المسار بعد.</p>
                )}
              </div>
            </div>
            {readOnly ? null : (
              <div className="col-span-2 flex flex-wrap items-start gap-2 md:col-span-1 md:flex-col md:items-stretch">
                {archived ? null : (
                  <>
                    <FormDialog
                      trigger={
                        <>
                          <Layers aria-hidden="true" strokeWidth={1.75} />
                          البرامج
                        </>
                      }
                      triggerSize="sm"
                      title={`برامج مسار «${t.name}»`}
                      description="اختر البرامج التي تندرج في هذا المسار. يمكن أن يكون البرنامج في أكثر من مسار."
                      submitLabel="حفظ البرامج"
                      wide
                      action={setTrackProgramsAction.bind(null, t.id)}
                    >
                      {(e) => (
                        <fieldset>
                          <legend className="sr-only">البرامج</legend>
                          <div className="flex flex-col gap-2">
                            {programs.map((p) => (
                              <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
                                <input type="checkbox" name="programIds" value={p.id} defaultChecked={open.some((x) => x.id === p.id)} className="size-4 accent-[var(--primary)]" />
                                <span className="t-figure text-ink-subtle">{toArabicDigits(p.number)}.</span>
                                <span className="text-ink">{p.name}</span>
                              </label>
                            ))}
                          </div>
                          {e.programIds ? (
                            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
                              {e.programIds}
                            </p>
                          ) : null}
                        </fieldset>
                      )}
                    </FormDialog>
                    <FormDialog
                      trigger={
                        <>
                          <PenLine aria-hidden="true" strokeWidth={1.75} />
                          تعديل
                        </>
                      }
                      triggerSize="sm"
                      title={`تعديل المسار ${toArabicDigits(t.number)}`}
                      submitLabel="حفظ"
                      wide
                      action={updateTrackAction.bind(null, t.id)}
                    >
                      {(e) => <TrackFields prefix={`track-${t.number}`} error={e} track={t} />}
                    </FormDialog>
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
                  title={archived ? "استعادة المسار" : "أرشفة المسار"}
                  description={
                    archived
                      ? `يعود «${t.name}» إلى التوزيع على المسارات في لوحات المتابعة.`
                      : `يختفي «${t.name}» من التوزيع على المسارات في لوحات المتابعة، وتبقى روابطه بالبرامج محفوظة لاستعادته.`
                  }
                  confirmLabel={archived ? "استعادة" : "أرشفة"}
                  onConfirm={async () => {
                    await setTrackArchivedAction(t.id, !archived);
                    router.refresh();
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
