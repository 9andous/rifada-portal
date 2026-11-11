"use client";

import { ArrowLeft, ChevronRight, Headset, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

type Topic = { question: string; answer: string[]; action?: { label: string; href: string } };

// Answers restate what the public pages already say; nothing here is a new promise.
const TOPICS: Topic[] = [
  {
    question: "كيف تنضم جمعيتي إلى المنصة؟",
    answer: [
      "تُضاف الجمعيات إلى المنصة من قِبل إدارة المنصة في الوحدة الإشرافية، ويُنشأ لكل جمعية حساب واحد لمسؤولها.",
      "للانضمام، تواصلوا مع الوحدة الإشرافية عبر الموقع الرسمي للرئاسة.",
    ],
  },
  {
    question: "كيف أدخل إلى المنصة؟",
    answer: ["ادخلوا باسم المستخدم وكلمة المرور اللذين وصلاكم من إدارة المنصة. عند أول دخول تُطلب منكم كلمة مرور جديدة."],
    action: { label: "تسجيل الدخول", href: "/login" },
  },
  {
    question: "كيف أقدّم طلبًا لمشروع أو برنامج؟",
    answer: [
      "بعد الدخول اختاروا «تقديم طلب جديد»: تكتبون بيانات المشروع خطوة خطوة، وتُرفقون ملفاته الداعمة، ثم ترسلونه إلى الوحدة الإشرافية.",
      "يُحفظ الطلب مسودة أثناء كتابته، فيمكنكم إكماله لاحقًا من «طلباتي».",
    ],
    action: { label: "تسجيل الدخول", href: "/login" },
  },
  {
    question: "كيف أتابع طلباتي؟",
    answer: [
      "تظهر حالة كل طلب في «طلباتي»، وتصلكم إشعارات عند مراجعته أو إعادته للتعديل أو صدور القرار.",
      "ويمكنكم مراسلة الوحدة الإشرافية من صفحة الطلب نفسه.",
    ],
    action: { label: "تسجيل الدخول", href: "/login" },
  },
  {
    question: "نسيت كلمة المرور",
    answer: ["يمكنكم طلب رابط لإعادة تعيين كلمة المرور من صفحة استعادة كلمة المرور."],
    action: { label: "استعادة كلمة المرور", href: "/forgot-password" },
  },
];

// The signed-in screens have their own navigation; the assistant serves the public pages.
const PUBLIC_PATHS = ["/", "/login", "/forgot-password", "/reset-password"];

/** Floating help button with a small panel of common questions, at the bottom start corner. */
export function SupportWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const visible = PUBLIC_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
  if (!visible) return null;

  const current = topic === null ? null : TOPICS[topic];

  return (
    <div data-print="hide" className="fixed bottom-5 start-5 z-40 flex flex-col items-start gap-3">
      {open ? (
        <div
          ref={panelRef}
          id="support-panel"
          role="dialog"
          aria-label="مساعد المنصة"
          tabIndex={-1}
          className="fade-up flex max-h-[min(34rem,calc(100dvh-7rem))] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2 outline-none"
        >
          <header className="band-scope relative overflow-hidden bg-band px-5 py-4 text-band-ink">
            <GeometricPattern size={56} />
            <div className="relative flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-band-gold text-band">
                <Headset aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">مساعد المنصة</p>
                <p className="text-xs text-band-ink-muted">إجابات سريعة عن الدخول وتقديم الطلبات</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق المساعد"
                className="rounded-md p-1.5 text-band-ink-muted transition-colors hover:bg-white/10 hover:text-band-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {current ? (
              <div key={topic} className="fade-up">
                <button type="button" onClick={() => setTopic(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
                  <ChevronRight aria-hidden="true" className="size-3.5" />
                  كل الأسئلة
                </button>
                <p className="mt-3 ms-auto w-fit max-w-[85%] rounded-xl rounded-se-sm bg-primary-soft px-3.5 py-2 text-sm font-semibold text-brand-ink">{current.question}</p>
                <div className="mt-3 max-w-[92%] space-y-2 rounded-xl rounded-ss-sm border border-line bg-surface-muted px-3.5 py-3 text-sm leading-[1.85] text-ink">
                  {current.answer.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                {current.action ? (
                  <Link
                    href={current.action.href}
                    onClick={() => setOpen(false)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90"
                  >
                    {current.action.label}
                    <ArrowLeft aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-ink-muted">أهلًا بكم. اختاروا سؤالًا لتظهر إجابته:</p>
                <ul className="mt-3 grid gap-2">
                  {TOPICS.map((t, i) => (
                    <li key={t.question}>
                      <button
                        type="button"
                        onClick={() => setTopic(i)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-start text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:bg-primary-soft/50"
                      >
                        {t.question}
                        <ArrowLeft aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <footer className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
            لأي استفسار آخر:{" "}
            <a href={brand.presidencyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink hover:underline">
              الموقع الرسمي للرئاسة
              <span className="sr-only">(يفتح في نافذة جديدة)</span>
            </a>
          </footer>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? "support-panel" : undefined}
        className={cn(
          // A labelled pill (owner's review, D-130): «المساعدة» says what it is without guessing at an icon.
          "inline-flex h-12 items-center gap-2 rounded-full border border-gold-action bg-band px-5 text-[0.9375rem] font-bold text-band-ink shadow-2 transition-transform hover:-translate-y-0.5",
        )}
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <MessageSquare aria-hidden="true" className="size-5" strokeWidth={1.75} />}
        {open ? "إغلاق" : "المساعدة"}
      </button>
    </div>
  );
}
