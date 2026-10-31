import { Check, Hourglass, PenLine, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { Timeline, TimelineItem, TimelineText } from "@/components/ui/timeline";
import { REVIEW_CRITERIA } from "@/config/review-criteria";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { ReviewView, ScopeSnapshotView, TimelineEntry } from "@/server/services/requests/read";

// The staff's view of the two-step review (D-116): the programme and initiative cards under the
// stepper, the supervisor's signed evaluation, and «سجل الطلب» joining status moves, evaluations
// and programme changes. None of it is shown to the association.

/**
 * Where the request belongs (D-123), right under the stepper: the track and request type the
 * association chose and always every programme of that track; a classification marks its programme
 * and lists the initiatives under it. Classifying is optional: the request is decided either way.
 */
export function ScopeCards({
  track,
  requestType,
  trackPrograms,
  program,
  initiatives,
  editor,
}: {
  track: { number: number; name: string } | null;
  requestType: string | null;
  trackPrograms: { id: string; number: number; name: string; description: string | null }[];
  program: { id: string; number: number; name: string } | null;
  initiatives: { id: string; number: number; name: string }[];
  editor?: ReactNode;
}) {
  return (
    <section aria-labelledby="scope-track" className="overflow-hidden rounded-xl border border-line bg-surface shadow-1">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="border-b border-line bg-primary-soft/40 px-6 py-5 md:border-b-0 md:border-e">
          <div className="border-s-4 border-accent ps-4">
            <p className="text-sm font-semibold text-accent-ink">المسار المستهدف</p>
            <h2 id="scope-track" className="mt-1 text-xl font-bold leading-snug text-brand-ink">
              {track ? track.name : "لم يُحدَّد"}
            </h2>
            {requestType ? (
              <p className="mt-2 text-sm text-ink-muted">
                نوع الطلب: <span className="font-semibold text-ink">{requestType}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink-muted">{`برامج هذا المسار (${formatNumber(trackPrograms.length)})`}</p>
            {editor}
          </div>
          {/* Always the whole track, so the supervisor sees every programme the request may fall
              under; a classification only marks its programme in the list (owner's request). */}
          {trackPrograms.length ? (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {trackPrograms.map((p) => {
                  const classified = p.id === program?.id;
                  return (
                    <li key={p.id} className={cn("rounded-lg border bg-surface px-3.5 py-2.5", "border-line", classified && "border-s-4 border-s-primary")}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[0.9375rem] font-semibold leading-snug text-ink">{p.name}</p>
                        {classified ? <StatusText tone="ok">التصنيف</StatusText> : null}
                      </div>
                      {p.description ? <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{p.description}</p> : null}
                      {classified && initiatives.length ? (
                        <ol className={cn("mt-2.5 grid grid-cols-1 gap-2", initiatives.length > 1 && "lg:grid-cols-2")}>
                          {initiatives.map((i) => (
                            <li key={i.id} className="flex items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2">
                              <span className="t-figure shrink-0 text-sm text-ink-muted">{toArabicDigits(i.number)}.</span>
                              <span className="min-w-0 text-sm font-semibold leading-snug text-ink">{i.name}</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-ink-subtle">يندرج الطلب تحت أحد هذه البرامج. تحديد البرنامج والمبادرات اختياري، ويمكن البتّ في الطلب دونه.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">لم تُربط برامج بهذا المسار بعد.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** The latest signed evaluation: each criterion met or not with its note, the note and the electronic seals. */
export function EvaluationCard({ review, editor }: { review: ReviewView; editor?: ReactNode }) {
  const e = review.evaluations.at(-1);
  if (!e) return null;
  const met = e.criteria.filter((c) => c.met).length;
  // The unit manager's signed approval of this evaluation (D-117).
  const approval = review.approvals.filter((a) => a.createdAt > e.createdAt).at(-1);
  return (
    <Panel>
      <PanelHeader
        title="تقييم المشرف"
        description={`مستوفى ${formatNumber(met)} من ${formatNumber(e.criteria.length)} معايير`}
        actions={editor ?? (review.stage === "MANAGER" ? <StatusText tone="review">بانتظار مدير الوحدة</StatusText> : null)}
        className="mb-4 py-3.5"
      />
      <div className="flex flex-col gap-4 px-5 pb-5 sm:px-6">
        <ul className="flex flex-col gap-2.5">
          {REVIEW_CRITERIA.map((c) => {
            const r = e.criteria.find((x) => x.key === c.key);
            if (!r) return null;
            return (
              <li key={c.key} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white [&_svg]:size-3", r.met ? "bg-st-ok" : "bg-st-bad")}
                >
                  {r.met ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <p className="text-ink">
                    {c.title}
                    <span className="sr-only">{r.met ? ": مستوفى" : ": غير مستوفى"}</span>
                  </p>
                  {r.note ? <p className="mt-0.5 whitespace-pre-line text-ink-muted">{r.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
        {e.edited ? (
          <p className="t-caption -mt-1">
            عدّله {e.edited.by} · <DateDisplay date={e.edited.at} withTime />
          </p>
        ) : null}
        {e.note ? (
          <div className="rounded-md border-s-4 border-accent bg-accent-soft/50 px-3 py-2.5">
            <p className="text-xs font-semibold text-accent-ink">ملاحظة المراجع الفني</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">{e.note}</p>
          </div>
        ) : null}
        <div className={cn("grid gap-3", approval ? "grid-cols-2" : "grid-cols-1")}>
          <SealStamp role="المشرف" name={e.reviewer} serial={e.seal?.serial ?? null} at={e.createdAt} />
          {approval ? <SealStamp role="مدير الوحدة" name={approval.manager} serial={approval.seal?.serial ?? null} at={approval.createdAt} verifyCode={approval.seal?.verifyCode ?? null} /> : null}
        </div>
      </div>
    </Panel>
  );
}

/** One electronic seal (D-122): who signed, when, and the seal's serial number. */
function SealStamp({ role, name, serial, at, verifyCode }: { role: string; name: string; serial: string | null; at: Date; verifyCode?: string | null }) {
  return (
    <figure className="rounded-md border border-line p-3 text-center">
      <figcaption className="t-caption">{role}</figcaption>
      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm font-bold text-st-ok">
        <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
        موقّع إلكترونيًا
      </p>
      <p className="mt-1 font-semibold text-ink">{name}</p>
      <DateDisplay date={at} withTime className="t-caption block" />
      {serial ? (
        <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-ink-muted">
          رقم الختم <bdi dir="ltr" className="font-mono text-ink">{serial}</bdi>
        </p>
      ) : null}
      {verifyCode ? (
        <Link href={`/verify/${verifyCode}`} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">
          التحقق من الوثيقة
        </Link>
      ) : null}
    </figure>
  );
}

const scopeLine = (s: ScopeSnapshotView) => (s.program ? `${s.program.name} ← ${s.initiatives.map((i) => `${toArabicDigits(i.number)}. ${i.name}`).join("، ")}` : "غير مصنّف");

type LogItem = { id: string; at: Date; node: ReactNode };

/** «سجل الطلب» for the staff: status moves, the supervisor's evaluations and programme changes, newest first. */
export function RequestLog({ timeline, review }: { timeline: TimelineEntry[]; review: ReviewView }) {
  const items: LogItem[] = [
    ...timeline.map((t) => ({
      id: `s-${t.id}`,
      at: t.createdAt,
      node: (
        <>
          <StatusText tone={t.to.tone}>{t.to.name}</StatusText>
          <p className="mt-1 text-sm text-ink">{t.actor ?? "النظام"}</p>
          {t.note ? <TimelineText className="whitespace-pre-line">{t.note}</TimelineText> : null}
        </>
      ),
    })),
    ...review.evaluations.map((e) => ({
      id: `e-${e.id}`,
      at: e.createdAt,
      node: (
        <>
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <PenLine aria-hidden="true" strokeWidth={1.75} className="size-4 text-primary" />
            قيّم الطلب ووقّعه إلكترونيًا وأرسله إلى مدير الوحدة
          </p>
          <p className="mt-1 text-sm text-ink">{e.reviewer}</p>
          <TimelineText>
            مستوفى {formatNumber(e.criteria.filter((c) => c.met).length)} من {formatNumber(e.criteria.length)} معايير
          </TimelineText>
        </>
      ),
    })),
    ...review.evaluations
      .filter((e) => e.edited)
      .map((e) => ({
        id: `ee-${e.id}`,
        at: e.edited!.at,
        node: (
          <>
            <p className="text-sm font-bold text-ink">عُدّل تقييم المشرف</p>
            <p className="mt-1 text-sm text-ink">{e.edited!.by}</p>
            <TimelineText>
              مستوفى {formatNumber(e.criteria.filter((c) => c.met).length)} من {formatNumber(e.criteria.length)} معايير بعد التعديل
            </TimelineText>
          </>
        ),
      })),
    ...review.scopeChanges.map((c) => ({
      id: `c-${c.id}`,
      at: c.createdAt,
      node: (
        <>
          <p className="text-sm font-bold text-ink">عُدّل البرنامج والمبادرات</p>
          <p className="mt-1 text-sm text-ink">
            {c.actor} <span className="t-caption">· {c.actorRole}</span>
          </p>
          <TimelineText>
            <span className="block line-through decoration-ink-subtle/60">{scopeLine(c.before)}</span>
            <span className="block text-ink">{scopeLine(c.after)}</span>
            {c.note ? <span className="mt-1 block whitespace-pre-line">السبب: {c.note}</span> : null}
          </TimelineText>
        </>
      ),
    })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime());

  return (
    <Timeline>
      {review.stage === "MANAGER" ? (
        <TimelineItem marker="current">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Hourglass aria-hidden="true" strokeWidth={1.75} className="size-4 text-accent-ink" />
            بانتظار اعتماد مدير الوحدة
          </p>
          <TimelineText>تظهر الحالة للجمعية «قيد المراجعة».</TimelineText>
        </TimelineItem>
      ) : null}
      {items.map((it, i) => (
        <TimelineItem key={it.id} marker={i === 0 && review.stage !== "MANAGER" ? "current" : "muted"}>
          {it.node}
          <DateDisplay date={it.at} withTime className="t-caption mt-1" />
        </TimelineItem>
      ))}
    </Timeline>
  );
}
