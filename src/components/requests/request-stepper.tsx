import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";

const STEPS = [
  { title: "تقديم الطلب", hint: "من الجمعية" },
  { title: "فحص الاكتمال", hint: "تلقائي" },
  { title: "المراجعة الفنية", hint: "المشرف المختص" },
  { title: "القرار", hint: "اعتماد أو رفض" },
] as const;

/** Index of the current step for a status key, and whether the request has reached a decision. */
function progress(statusKey: string): { current: number; done: boolean; rejected: boolean; returned: boolean } {
  switch (statusKey) {
    case "DRAFT":
      return { current: 0, done: false, rejected: false, returned: false };
    case "SUBMITTED":
    case "COMPLETENESS_CHECK":
      return { current: 1, done: false, rejected: false, returned: false };
    case "UNDER_REVIEW":
      return { current: 2, done: false, rejected: false, returned: false };
    case "RETURNED":
      return { current: 2, done: false, rejected: false, returned: true };
    case "APPROVED":
      return { current: 3, done: true, rejected: false, returned: false };
    case "REJECTED":
      return { current: 3, done: true, rejected: true, returned: false };
    default:
      return { current: 0, done: false, rejected: false, returned: false };
  }
}

/** Where a request stands in the supervision journey (design handoff stepper). */
export function RequestStepper({ statusKey, className }: { statusKey: string; className?: string }) {
  const p = progress(statusKey);
  return (
    <ol aria-label="مراحل الطلب" className={cn("grid grid-cols-4", className)}>
      {STEPS.map((s, i) => {
        const isDone = i < p.current || (p.done && i === p.current);
        const isCurrent = i === p.current && !p.done;
        const bad = p.rejected && i === p.current;
        return (
          <li key={s.title} aria-current={isCurrent ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
            {i < STEPS.length - 1 ? (
              <span aria-hidden="true" className={cn("absolute start-1/2 top-[17px] h-0.5 w-full", i < p.current ? "bg-primary" : "bg-line")} />
            ) : null}
            <span
              className={cn(
                "t-figure relative z-10 flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold [&_svg]:size-4",
                bad
                  ? "border-st-bad bg-st-bad text-white"
                  : isDone
                    ? "border-primary bg-primary text-primary-ink"
                    : isCurrent
                      ? "border-accent bg-accent-soft text-accent-ink ring-[5px] ring-accent/15"
                      : "border-line-strong bg-surface text-ink-subtle",
              )}
            >
              {bad ? <X aria-hidden="true" strokeWidth={2.5} /> : isDone ? <Check aria-hidden="true" strokeWidth={2.5} /> : toArabicDigits(i + 1)}
            </span>
            <span className={cn("text-[0.8125rem] leading-snug", isCurrent ? "font-bold text-ink" : isDone ? "font-medium text-ink-muted" : "text-ink-subtle")}>
              {i === 2 && p.returned ? "معاد للتعديل" : i === 3 && p.done ? (p.rejected ? "مرفوض" : "معتمد") : s.title}
              <span className="block text-[0.6875rem] font-normal text-ink-subtle">{s.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
