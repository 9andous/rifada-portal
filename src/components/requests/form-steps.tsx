import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { HeaderIcon, Panel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";

const STEPS = [
  { title: "البرنامج والمبادرة", text: "اختيار مجال الطلب ضمن برامج الرئاسة." },
  { title: "بيانات الطلب", text: "الوصف والفئة المستهدفة والمكان والمدة." },
  { title: "المتطلبات والمرفقات", text: "بيانات المبادرة والملفات المطلوبة." },
  { title: "التقديم", text: "فحص الاكتمال ثم الإحالة إلى المشرف المختص." },
] as const;

/** Side guide of the request form: the four steps with the current one marked, and a help note. */
export function FormSteps({ current, icon, children }: { current: number; icon?: ReactNode; children?: ReactNode }) {
  return (
    <Panel className="p-5 lg:sticky lg:top-[100px]">
      <div className="mb-5 flex items-center gap-3">
        <HeaderIcon icon={icon} tone="gold" />
        <h2 className="t-section">خطوات الطلب</h2>
      </div>
      <ol className="flex flex-col">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.title} aria-current={active ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
              {i < STEPS.length - 1 ? <span aria-hidden="true" className={cn("absolute start-[15px] top-9 h-[calc(100%-2.25rem)] w-0.5", done ? "bg-primary" : "bg-line")} /> : null}
              <span
                className={cn(
                  "t-figure flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  done ? "border-primary bg-primary text-primary-ink" : active ? "border-accent bg-accent-soft text-accent-ink ring-4 ring-accent/15" : "border-line-strong bg-surface text-ink-subtle",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-4" strokeWidth={2.5} /> : toArabicDigits(i + 1)}
              </span>
              <span className="pt-1">
                <span className={cn("block text-sm", active ? "font-bold text-ink" : done ? "font-medium text-ink-muted" : "text-ink-subtle")}>{s.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-subtle">{s.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {children ? <div className="mt-5 rounded-lg border border-line bg-surface-muted p-4 text-[0.8125rem] leading-relaxed text-ink-muted">{children}</div> : null}
    </Panel>
  );
}
