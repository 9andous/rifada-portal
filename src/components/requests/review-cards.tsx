import { Check, Hourglass, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { Timeline, TimelineItem, TimelineText } from "@/components/ui/timeline";
import { REVIEW_CRITERIA } from "@/config/review-criteria";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { DECISION_STATUS, RECOMMENDATION_LABELS, RECOMMENDATION_TONES } from "@/lib/requests";
import { ROLE_LABELS } from "@/server/authz/roles";
import type { ReviewView, ScopeSnapshotView, TimelineEntry } from "@/server/services/requests/read";

// The staff's view of the two-step review (D-116): the programme and initiative cards under the
// stepper, the supervisor's signed evaluation, and «سجل الطلب» joining status moves, evaluations
// and programme changes. None of it is shown to the association.

/**
 * Where the request belongs (D-123, compact per the owner, D-138, D-145): one card with the track the
 * association chose and the request type. Until a supervisor chooses, it lists the names of the
 * track's programmes; afterwards only the chosen programme and initiatives, which `editor` can change.
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
  trackPrograms: { id: string; number: number; name: string }[];
  program: { id: string; number: number; name: string } | null;
  initiatives: { id: string; number: number; name: string }[];
  editor?: ReactNode;
}) {
  return (
    <section aria-label="مسار الطلب وبرنامجه" className="rounded-xl border border-line bg-surface px-5 py-4 shadow-1 sm:px-6">
      <div className="flex items-start gap-4 border-s-4 border-accent ps-4">
        <dl className="flex min-w-0 flex-1 flex-col gap-2.5">
          <ScopeRow label="المسار">
            <span className="font-bold text-brand-ink">{track ? track.name : "لم يُحدَّد"}</span>
            {requestType ? <span className="text-ink-muted"> · {requestType}</span> : null}
          </ScopeRow>
          {program ? (
            <>
              <ScopeRow label="البرنامج">
                <span className="font-semibold text-ink">{program.name}</span>
              </ScopeRow>
              {initiatives.length ? (
                <ScopeRow label={initiatives.length > 1 ? "المبادرات" : "المبادرة"}>
                  <ol className="flex flex-col gap-1">
                    {initiatives.map((i) => (
                      <li key={i.id} className="flex gap-1.5 text-ink">
                        <span className="t-figure shrink-0 text-ink-muted">{toArabicDigits(i.number)}.</span>
                        <span className="min-w-0">{i.name}</span>
                      </li>
                    ))}
                  </ol>
                </ScopeRow>
              ) : null}
            </>
          ) : (
            <ScopeRow label="البرامج">
              {trackPrograms.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {trackPrograms.map((p) => (
                    <li key={p.id} className="rounded-md border border-line bg-surface-muted px-2.5 py-1 text-sm text-ink">
                      {p.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-muted">لم تُربط برامج بهذا المسار بعد.</span>
              )}
            </ScopeRow>
          )}
        </dl>
        {editor ? <div className="shrink-0">{editor}</div> : null}
      </div>
    </section>
  );
}

function ScopeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
      <dt className="text-sm font-semibold text-ink-subtle sm:pt-px">{label}</dt>
      <dd className="min-w-0 text-[0.9375rem] leading-snug">{children}</dd>
    </div>
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
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            توصية المشرف:
            <StatusText tone={RECOMMENDATION_TONES[e.recommendation]}>{RECOMMENDATION_LABELS[e.recommendation]}</StatusText>
          </p>
          {e.reason ? <p className="mt-1.5 whitespace-pre-line text-sm text-ink-muted">{e.reason}</p> : null}
        </div>
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

function LogActor({ name, role }: { name: string; role: string | null }) {
  return (
    <p className="mt-1 text-sm text-ink">
      {name}
      {role ? <span className="t-caption"> · {role}</span> : null}
    </p>
  );
}

function assignmentTitle(a: ReviewView["assignments"][number]): string {
  if (!a.to) return "أصبح الطلب بلا مشرف";
  if (!a.actor) return `أُسند الطلب تلقائيًا إلى ${a.to}`;
  if (a.actor === a.to) return a.from ? `تولّى الطلب بدلًا من ${a.from}` : "تولّى الطلب";
  return `أُسند الطلب إلى ${a.to}`;
}

/** «سجل الطلب» for the staff (D-146): who did what. Status moves, evaluations and recommendations, changes to them, programme changes and assignments, newest first. */
export function RequestLog({ timeline, review }: { timeline: TimelineEntry[]; review: ReviewView }) {
  // The evaluation a unit manager's decision answers: the latest one before it.
  const answered = (t: TimelineEntry) => (t.actorRole === "UNIT_MANAGER" ? review.evaluations.filter((e) => e.createdAt < t.createdAt).at(-1) : undefined);
  const items: LogItem[] = [
    ...timeline.map((t) => {
      const evaluation = answered(t);
      const overruled = evaluation && DECISION_STATUS[evaluation.recommendation] !== t.to.key;
      return {
        id: `s-${t.id}`,
        at: t.createdAt,
        node: (
          <>
            <StatusText tone={t.to.tone}>{t.to.name}</StatusText>
            <LogActor name={t.actor ?? "النظام"} role={t.actorRole ? ROLE_LABELS[t.actorRole] : null} />
            {evaluation ? (
              <TimelineText>
                {overruled ? "خلاف توصية المشرف" : "وفق توصية المشرف"}: {RECOMMENDATION_LABELS[evaluation.recommendation]}
              </TimelineText>
            ) : null}
            {t.note ? <TimelineText className="whitespace-pre-line">{t.note}</TimelineText> : null}
          </>
        ),
      };
    }),
    ...review.evaluations.map((e) => ({
      id: `e-${e.id}`,
      at: e.createdAt,
      node: (
        <>
          <p className="text-sm font-bold text-ink">قيّم الطلب ورفعه إلى مدير الوحدة</p>
          <LogActor name={e.reviewer} role={ROLE_LABELS.SUPERVISOR} />
          <p className="mt-1.5">
            <StatusText tone={RECOMMENDATION_TONES[e.recommendation]}>{`التوصية: ${RECOMMENDATION_LABELS[e.recommendation]}`}</StatusText>
          </p>
          <TimelineText>
            مستوفى {formatNumber(e.criteria.filter((c) => c.met).length)} من {formatNumber(e.criteria.length)} معايير
            {e.reason ? <span className="mt-1 block whitespace-pre-line">السبب: {e.reason}</span> : null}
            {e.note ? <span className="mt-1 block whitespace-pre-line">ملاحظة المراجع الفني: {e.note}</span> : null}
          </TimelineText>
        </>
      ),
    })),
    ...review.assignments.map((a) => ({
      id: `a-${a.id}`,
      at: a.createdAt,
      node: (
        <>
          <p className="text-sm font-bold text-ink">{assignmentTitle(a)}</p>
          <p className="mt-1 text-sm text-ink">{a.actor ?? "النظام"}</p>
          {a.reason ? <TimelineText className="whitespace-pre-line">{a.reason}</TimelineText> : null}
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
            بانتظار قرار مدير الوحدة
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
