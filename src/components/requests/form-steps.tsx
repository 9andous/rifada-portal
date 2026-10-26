import type { ReactNode } from "react";
import { HeaderDiamond, Panel } from "@/components/ui/surface";
import { Timeline, TimelineItem, TimelineText, TimelineTitle } from "@/components/ui/timeline";

const STEPS = [
  { title: "البرنامج والمبادرة", text: "اختيار مجال الطلب ضمن برامج الرئاسة." },
  { title: "بيانات الطلب", text: "الوصف والفئة المستهدفة والمكان والمدة." },
  { title: "المتطلبات والمرفقات", text: "بيانات المبادرة والملفات المطلوبة." },
  { title: "التقديم", text: "فحص الاكتمال ثم الإحالة إلى المشرف المختص." },
] as const;

/** Side guide of the request form: the four steps on the shared timeline (done green, current gold), and a note. */
export function FormSteps({ current, children }: { current: number; children?: ReactNode }) {
  return (
    <Panel className="p-5 lg:sticky lg:top-[168px]">
      <div className="mb-5 flex items-start gap-3">
        <HeaderDiamond />
        <h2 className="t-section">خطوات الطلب</h2>
      </div>
      <Timeline>
        {STEPS.map((s, i) => {
          const marker = i < current ? "done" : i === current ? "current" : "muted";
          return (
            <TimelineItem key={s.title} marker={marker} step>
              <TimelineTitle strong={marker === "current"}>{s.title}</TimelineTitle>
              <TimelineText>{s.text}</TimelineText>
            </TimelineItem>
          );
        })}
      </Timeline>
      {children ? <div className="mt-6 border-s-2 border-accent ps-4 text-[0.8125rem] leading-relaxed text-ink-muted">{children}</div> : null}
    </Panel>
  );
}
