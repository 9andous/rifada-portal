"use client";

import { BookmarkCheck, Check, ClipboardCheck, Copy, House, KeyRound, Quote, SearchCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ARCH_INNER_PATH, ARCH_PATH } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { buttonClasses } from "@/components/ui/button";
import { toArabicDigits } from "@/lib/format";

const NEXT = [
  { icon: SearchCheck, title: "مراجعة الطلب", text: "تتحقق الوحدة الإشرافية من بيانات الجمعية وترخيصها." },
  { icon: ClipboardCheck, title: "القرار", text: "يُعتمد الطلب فيُفعَّل حساب الجمعية، أو يُعاد إليكم مع السبب." },
  { icon: KeyRound, title: "الدخول إلى المنصة", text: "بعد الاعتماد تدخلون باسم المستخدم وكلمة المرور التي اخترتموها." },
];

/** Shown after a successful submission: the reference number and what happens next. */
export function RegistrationSuccess({ referenceNo, vision }: { referenceNo: string; vision: string | null }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(referenceNo);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable; the number stays visible to copy by hand.
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-12 sm:px-8">
      <section aria-labelledby="done-title" className="fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-2">
        <div className="band-scope relative overflow-hidden bg-band px-6 py-12 text-center text-band-ink sm:px-10">
          <GeometricPattern size={84} />
          <Image src="/images/haramain/kaaba-tawaf.jpg" alt="" fill sizes="1100px" className="object-cover opacity-[0.12]" />
          <div className="relative mx-auto grid h-[110px] w-[92px] place-items-center text-band-gold">
            <svg aria-hidden="true" viewBox="0 0 200 250" fill="none" preserveAspectRatio="none" className="absolute inset-0 size-full">
              <path d={ARCH_PATH} stroke="currentColor" strokeWidth="6" />
              <path d={ARCH_INNER_PATH} stroke="currentColor" strokeWidth="3" opacity="0.5" />
            </svg>
            <span className="relative mt-7 flex size-11 items-center justify-center rounded-full bg-band-gold text-band">
              <Check aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
          </div>
          <h1 id="done-title" className="relative mt-5 text-[1.875rem] font-bold">
            استلمنا طلب تسجيل جمعيتكم
          </h1>
          <p className="relative mx-auto mt-2 max-w-xl text-band-ink-muted">جزاكم الله خيرًا على حرصكم على خدمة قاصدي الحرمين الشريفين. احتفظوا برقم الطلب لمتابعة حالته.</p>
          <div className="relative mx-auto mt-7 inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-5 py-3">
            <span className="text-sm text-band-ink-muted">رقم الطلب</span>
            <bdi dir="ltr" className="text-2xl font-bold tracking-wider text-band-gold">
              {referenceNo}
            </bdi>
            <button type="button" onClick={copy} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10" aria-label="نسخ رقم الطلب">
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            </button>
          </div>
          <p className="relative mt-2 text-xs text-band-ink-muted" aria-live="polite">
            {copied ? "نُسخ رقم الطلب." : " "}
          </p>
          <div className="relative mx-auto mt-4 flex max-w-xl flex-col items-center rounded-xl border border-band-gold/50 bg-band/80 px-6 py-4 text-center">
            <BookmarkCheck aria-hidden="true" className="size-5 text-band-gold" strokeWidth={1.75} />
            <p className="mt-1.5 text-sm leading-[1.85] text-band-ink">
              <span className="block text-[0.9375rem] font-bold text-band-gold">احفظوا رقم الطلب</span>
              تحتاجونه مع رقم ترخيص الجمعية لمتابعة حالة طلبكم في أي وقت من صفحة «متابعة طلب التسجيل». انسخوه أو دوّنوه قبل مغادرة هذه الصفحة.
            </p>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10">
          <h2 className="text-center text-lg font-bold text-brand-ink">ماذا بعد؟</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {NEXT.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex flex-col items-center rounded-xl border border-line bg-surface-muted p-5 text-center">
                <span className="relative flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  <span className="t-figure absolute -end-2.5 -top-2.5 flex size-8 items-center justify-center rounded-full border-[3px] border-surface-muted bg-primary text-base text-primary-ink">
                    {toArabicDigits(i + 1)}
                  </span>
                </span>
                <p className="mt-3 font-bold text-ink">
                  <span className="sr-only">الخطوة {toArabicDigits(i + 1)}: </span>
                  {title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
          {vision ? (
            <figure className="mx-auto mt-8 max-w-2xl rounded-xl border border-accent/30 bg-accent-soft/50 px-6 py-5 text-center">
              <figcaption className="text-xs font-medium text-accent-ink">رؤية الرئاسة</figcaption>
              <blockquote className="mt-2 text-[0.9375rem] font-semibold leading-[1.9] text-ink">
                <Quote aria-hidden="true" className="mx-auto mb-1 size-4 -scale-x-100 text-accent-ink" />
                {vision}
              </blockquote>
            </figure>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register/status" className={buttonClasses("primary", "lg")}>
              <SearchCheck aria-hidden="true" />
              متابعة حالة الطلب
            </Link>
            <Link href="/" className={buttonClasses("outline", "lg")}>
              <House aria-hidden="true" />
              الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
