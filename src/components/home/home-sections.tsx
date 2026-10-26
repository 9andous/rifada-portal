import {
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  SearchCheck,
  Send,
  CircleCheck,
  Compass,
  Eye,
  LogIn,
  Quote,
  Target,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { Logo } from "@/components/brand/logo";
import { ProgramIcon } from "@/components/brand/program-icon";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { brand } from "@/config/brand";
import { INITIATIVE, LEADERSHIP_QUOTES, PRESIDENT_WORD, STRATEGY_MOTTO, SUPERVISION_STEPS } from "@/config/initiative";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { PublicHome } from "@/server/services/public-site";

const STEP_ICONS: Record<(typeof SUPERVISION_STEPS)[number]["icon"], LucideIcon> = {
  send: Send,
  check: ClipboardCheck,
  review: SearchCheck,
  decision: BadgeCheck,
};

const WRAP = "mx-auto w-full max-w-[1360px] px-4 sm:px-8";

function SectionHead({ eyebrow, title, lead, tone = "surface", id }: { eyebrow: string; title: string; lead?: ReactNode; tone?: "surface" | "band"; id: string }) {
  const band = tone === "band";
  return (
    <div className="max-w-3xl">
      <p className={cn("flex items-center gap-2 text-sm font-medium", band ? "text-band-gold" : "text-accent-ink")}>
        <Diamond className={band ? "bg-band-gold" : undefined} />
        {eyebrow}
      </p>
      <h2 id={id} className={cn("mt-2 text-[1.75rem] font-bold leading-snug md:text-[2rem]", band ? "text-band-ink" : "text-brand-ink")}>
        {title}
      </h2>
      {lead ? <p className={cn("mt-3 text-[0.9375rem] leading-[1.9]", band ? "text-band-ink-muted" : "text-ink-muted")}>{lead}</p> : null}
    </div>
  );
}

/* ───────── Hero ───────── */

export function HomeHero({ figures }: { figures: ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="band-scope relative overflow-hidden bg-band text-band-ink">
      <GeometricPattern size={96} />
      <div className={cn(WRAP, "relative grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20")}>
        <div className="fade-up">
          <p className="flex items-center gap-2 text-sm font-medium text-band-gold">
            <Diamond className="bg-band-gold" />
            {brand.presidencyName}
          </p>
          <h1 id="hero-title" className="mt-4 text-[2.125rem] font-bold leading-[1.4] md:text-[2.75rem]">
            {brand.unitName}
          </h1>
          <p className="mt-4 text-xl font-semibold text-band-gold">{STRATEGY_MOTTO}</p>
          <p className="mt-4 max-w-2xl text-base leading-[1.9] text-band-ink-muted">
            {brand.systemName} هي المنصة الرقمية للإشراف الفني على الجمعيات الخيرية والتطوعية التي تخدم قاصدي الحرمين الشريفين: تُقدَّم
            فيها البرامج والمشروعات ضمن برامج الرئاسة، وتُراجع وتُتابع بإجراءات واضحة وموثّقة.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={buttonClasses("gold", "lg")}>
              <LogIn aria-hidden="true" />
              الدخول إلى المنصة
            </Link>
            <Link href="/register" className={buttonClasses("outlineOnBand", "lg")}>
              سجّلوا جمعيتكم
              <ArrowLeft aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-10">{figures}</div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <ArchOutline strokeWidth={3} inner="transparent" className="absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] text-band-gold/60" />
          <div className="arch-mask relative aspect-[4/5] w-full">
            <Image
              src="/images/haramain/kaaba-tawaf.jpg"
              alt="الكعبة المشرفة والطائفون حولها في المسجد الحرام"
              fill
              priority
              sizes="(min-width: 1024px) 420px, 90vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroFigures({ home }: { home: PublicHome }) {
  const initiatives = home.programs.reduce((n, p) => n + p.initiativeCount, 0);
  const items = [
    { value: home.programs.length, label: "برامج للرئاسة" },
    { value: initiatives, label: "مبادرة متاحة للجمعيات" },
    { value: home.objectives.length, label: "أهداف استراتيجية" },
    { value: home.values.length, label: "قيم مؤسسية" },
  ];
  return (
    <dl className="grid max-w-2xl grid-cols-2 gap-y-5 border-t border-white/15 pt-6 sm:grid-cols-4">
      {items.map((f, i) => (
        <div key={f.label} className={cn("pe-4", i > 0 && "sm:border-s sm:border-white/15 sm:ps-5")}>
          <dd className="t-figure text-[2rem] text-band-ink">{formatNumber(f.value)}</dd>
          <dt className="mt-1.5 text-[0.8125rem] text-band-ink-muted">{f.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function HeroFiguresSkeleton() {
  return (
    <div aria-hidden="true" className="grid max-w-2xl grid-cols-2 gap-5 border-t border-white/15 pt-6 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="block h-16 animate-pulse rounded-sm bg-white/10" />
      ))}
    </div>
  );
}

/* ───────── Leadership ───────── */

/** Round portrait in a gold ring with a green arc beneath, as on the strategy's opening pages. */
function Portrait({ src, alt, size, tone }: { src: string; alt: string; size: number; tone: "band" | "surface" }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span aria-hidden="true" className={cn("absolute -inset-2 rounded-full border-2", tone === "band" ? "border-band-gold/70" : "border-accent/60")} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute -inset-3.5 rounded-full border-[6px] border-transparent",
          tone === "band" ? "border-b-band-gold/40" : "border-b-band",
        )}
      />
      <Image src={src} alt={alt} fill sizes={`${size}px`} className="rounded-full object-cover" />
    </span>
  );
}

export function LeadershipSection() {
  return (
    <section aria-labelledby="leadership-title" className="relative overflow-hidden border-b border-line bg-surface">
      <div className={cn(WRAP, "py-16")}>
        <div className="flex flex-col items-center text-center">
          <p className="flex items-center gap-2 text-sm font-medium text-accent-ink">
            <Diamond />
            شرف الخدمة
          </p>
          <h2 id="leadership-title" className="mt-2 text-[1.75rem] font-bold text-brand-ink md:text-[2rem]">
            خدمة الحرمين الشريفين مسؤولية وشرف
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {LEADERSHIP_QUOTES.map((q, i) => {
            const band = i === 0;
            return (
              <figure
                key={q.name}
                className={cn(
                  "relative flex flex-col items-center gap-7 overflow-hidden rounded-2xl border p-8 text-center sm:flex-row sm:items-center sm:text-start",
                  band ? "band-scope border-band bg-band text-band-ink" : "border-line bg-canvas",
                )}
              >
                {band ? <GeometricPattern size={72} /> : null}
                <ArchOutline
                  strokeWidth={5}
                  className={cn("absolute -bottom-12 end-6 w-32", band ? "text-band-gold/15" : "text-band opacity-[0.06] dark:text-accent")}
                />
                <Portrait src={q.image} alt={`${q.honorific} ${q.name}`} size={148} tone={band ? "band" : "surface"} />
                <div className="relative min-w-0">
                  <Quote aria-hidden="true" className={cn("mx-auto size-8 -scale-x-100 sm:mx-0", band ? "text-band-gold" : "text-accent")} strokeWidth={1.5} />
                  <blockquote className={cn("mt-2 text-[1.3125rem] font-bold leading-[1.8]", band ? "text-band-ink" : "text-brand-ink")}>{q.quote}</blockquote>
                  <figcaption className={cn("mt-5 border-t pt-4", band ? "border-white/15" : "border-line")}>
                    <span className={cn("block text-xs", band ? "text-band-ink-muted" : "text-ink-subtle")}>{q.honorific}</span>
                    <span className={cn("block font-bold", band ? "text-band-gold" : "text-accent-ink")}>{q.name}</span>
                    <span className={cn("block text-sm", band ? "text-band-ink-muted" : "text-ink-subtle")}>{q.title}</span>
                  </figcaption>
                </div>
              </figure>
            );
          })}
        </div>

        <figure className="relative mt-5 flex flex-col items-center gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-7 shadow-1 md:flex-row md:items-start md:gap-8 md:p-8">
          <span aria-hidden="true" className="absolute inset-y-0 start-0 w-1.5 bg-accent" />
          <Portrait src={PRESIDENT_WORD.image} alt={`${PRESIDENT_WORD.honorific} ${PRESIDENT_WORD.name}`} size={112} tone="surface" />
          <div className="min-w-0 text-center md:text-start">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-accent-ink md:justify-start">
              <Diamond />
              كلمة رئيس الشؤون الدينية
            </p>
            <blockquote className="mt-3 text-[1.0625rem] font-semibold leading-[2] text-ink">«{PRESIDENT_WORD.quote}»</blockquote>
            <figcaption className="mt-4">
              <span className="block text-xs text-ink-subtle">{PRESIDENT_WORD.honorific}</span>
              <span className="block font-bold text-brand-ink">{PRESIDENT_WORD.name}</span>
              <span className="block text-sm text-ink-subtle">{PRESIDENT_WORD.title}</span>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}

/* ───────── Vision and mission ───────── */

export function VisionSection({ home }: { home: PublicHome }) {
  if (!home.vision && !home.mission) return null;
  const cards = [
    { key: "vision", title: "الرؤية", text: home.vision, icon: Eye, image: "/images/haramain/masjid-al-haram.jpg", alt: "المسجد الحرام من الأعلى" },
    { key: "mission", title: "الرسالة", text: home.mission, icon: Compass, image: "/images/haramain/masjid-an-nabawi.jpg", alt: "المسجد النبوي الشريف" },
  ].filter((c) => c.text);
  return (
    <section aria-labelledby="vision-title" id="vision" className="scroll-mt-28">
      <div className={cn(WRAP, "py-16")}>
        <SectionHead
          id="vision-title"
          eyebrow="استراتيجية الرئاسة"
          title="الرؤية والرسالة"
          lead={`تعمل المنصة في إطار استراتيجية ${brand.presidencyName}، وتسهم في تحقيق رؤيتها ورسالتها من خلال حوكمة أعمال الجمعيات التي تخدم قاصدي الحرمين الشريفين.`}
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
          {cards.map(({ key, title, text, icon: Icon, image, alt }) => (
            <article key={key} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-1">
              <div className="relative h-52">
                <Image src={image} alt={alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-band-deep/85 to-transparent" />
                <h3 className="absolute bottom-4 start-5 flex items-center gap-2.5 text-xl font-bold text-white">
                  <span className="flex size-9 items-center justify-center rounded-[9px] bg-band-gold/25 text-band-gold backdrop-blur-sm">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  {title}
                </h3>
              </div>
              <p className={cn("flex-1 p-6 leading-[2] text-ink", key === "vision" ? "text-[1.375rem] font-bold text-brand-ink" : "text-base")}>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Values ───────── */

export function ValuesSection({ home }: { home: PublicHome }) {
  if (home.values.length === 0) return null;
  return (
    <section aria-labelledby="values-title" id="values" className="scroll-mt-28 border-y border-line bg-surface">
      <div className={cn(WRAP, "grid gap-10 py-16 lg:grid-cols-[minmax(0,380px)_1fr]")}>
        <div>
          <SectionHead id="values-title" eyebrow="ما نؤمن به" title="القيم" lead="قيم الرئاسة التي تحكم العمل في الحرمين الشريفين، وتلتزم بها المنصة في إجراءاتها وتعاملها مع الجمعيات." />
          <div className="relative mx-auto mt-8 hidden w-full max-w-[320px] lg:block">
            <div className="arch-mask relative aspect-[4/5] w-full">
              <Image src="/images/haramain/haram-arches.jpg" alt="أروقة المسجد الحرام وزخارفه" fill sizes="320px" className="object-cover" />
            </div>
            <ArchOutline strokeWidth={3} inner="transparent" className="absolute -inset-3 h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)] text-accent/50" />
          </div>
        </div>
        <ol className="grid gap-x-8 sm:grid-cols-2">
          {home.values.map((v) => (
            <li key={v.number} className="flex gap-4 border-b border-line py-5">
              <span aria-hidden="true" className="relative flex size-11 shrink-0 items-center justify-center">
                <span className="absolute inset-1 rotate-45 rounded-[6px] border border-accent/50 bg-accent-soft" />
                <span className="t-figure relative text-base text-accent-ink">{toArabicDigits(v.number)}</span>
              </span>
              <div className="min-w-0">
                <h3 className="text-[1.0625rem] font-bold text-brand-ink">{v.title}</h3>
                <p className="mt-1 text-sm leading-[1.85] text-ink-muted">{v.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────── Strategic objectives ───────── */

export function ObjectivesSection({ home }: { home: PublicHome }) {
  if (home.objectives.length === 0) return null;
  return (
    <section aria-labelledby="objectives-title" id="objectives" className="band-scope relative scroll-mt-28 overflow-hidden bg-band text-band-ink">
      <GeometricPattern size={96} />
      <ArchOutline strokeWidth={4} className="absolute -bottom-24 end-[-60px] w-[420px] text-band-gold/10" />
      <div className={cn(WRAP, "relative py-16")}>
        <SectionHead
          id="objectives-title"
          tone="band"
          eyebrow="إلى أين نتجه"
          title="الأهداف الاستراتيجية"
          lead="سبعة أهداف استراتيجية للرئاسة. تخدم مخرجات مبادرة الإشراف الفني أربعة منها مباشرة، وهي المميزة أدناه."
        />
        <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {home.objectives.map((o) => {
            const link = INITIATIVE.objectiveLinks[o.number];
            return (
              <li
                key={o.number}
                className={cn(
                  "flex flex-col rounded-lg border p-5",
                  link ? "border-band-gold/40 bg-white/[0.08]" : "border-white/10 bg-white/[0.04]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-[9px] bg-band-gold/15 text-band-gold">
                    <span className="t-figure text-lg">{toArabicDigits(o.number)}</span>
                  </span>
                  {link ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-band-gold/15 px-2 py-0.5 text-xs font-semibold text-band-gold">
                      <Target aria-hidden="true" className="size-3.5" />
                      تخدمه المنصة
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-[0.9375rem] font-semibold leading-[1.85]">{o.title}</p>
                {link ? <p className="mt-auto pt-4 text-[0.8125rem] leading-relaxed text-band-ink-muted">{link}</p> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ───────── Programmes ───────── */

export function ProgramsSection({ home }: { home: PublicHome }) {
  if (home.programs.length === 0) return null;
  return (
    <section aria-labelledby="programs-title" id="programs" className="scroll-mt-28">
      <div className={cn(WRAP, "py-16")}>
        <SectionHead
          id="programs-title"
          eyebrow="مجالات العمل"
          title="برامج الرئاسة"
          lead="تقدّم الجمعيات برامجها ومشروعاتها ضمن هذه البرامج ومبادراتها، فيكون كل طلب مرتبطًا بمبادرة محددة وبالأهداف الاستراتيجية التي تخدمها."
        />
        <ul className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {home.programs.map((p) => {
            return (
              <li key={p.number} className="group flex items-start gap-3.5 rounded-xl border border-line bg-surface p-5 shadow-1 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary hover:shadow-2">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <ProgramIcon number={p.number} className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-accent-ink">البرنامج {toArabicDigits(p.number)}</p>
                  <h3 className="mt-0.5 font-bold leading-snug text-ink">{p.name}</h3>
                  <p className="mt-2 text-[0.8125rem] text-ink-subtle">
                    {p.initiativeCount > 0 ? `${formatNumber(p.initiativeCount)} مبادرة` : "لا توجد مبادرات متاحة حاليًا"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function StrategySkeleton() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل" className={cn(WRAP, "grid gap-5 py-16 lg:grid-cols-2")}>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

/* ───────── The initiative ───────── */

export function InitiativeSection() {
  return (
    <section aria-labelledby="initiative-title" id="initiative" className="scroll-mt-28 border-y border-line bg-surface">
      <div className={cn(WRAP, "py-16")}>
        <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHead id="initiative-title" eyebrow="عن المنصة" title={INITIATIVE.name} lead={INITIATIVE.intro} />
            <p className="mt-6 rounded-lg border-s-4 border-accent bg-accent-soft px-5 py-4 font-semibold leading-[1.9] text-ink">{INITIATIVE.summary}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {INITIATIVE.tracks.map((t, i) => (
                <div key={t.title} className="rounded-xl border border-line bg-canvas p-5">
                  <span className="t-figure flex size-10 items-center justify-center rounded-full bg-band text-band-gold">{toArabicDigits(i + 1)}</span>
                  <h3 className="mt-3 font-bold text-brand-ink">{t.title}</h3>
                  <p className="mt-1.5 text-sm leading-[1.85] text-ink-muted">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="relative overflow-hidden rounded-2xl">
              <Image
                src="/images/haramain/kaaba-clock-tower.jpg"
                alt="المسجد الحرام والكعبة المشرفة"
                width={745}
                height={746}
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <h3 className="mt-6 font-bold text-brand-ink">مهام الرئاسة جهةً مشرفة فنيًا</h3>
            <ul className="mt-3 grid gap-2.5">
              {INITIATIVE.mandate.map((m) => (
                <li key={m} className="flex gap-2.5 text-sm leading-[1.85] text-ink-muted">
                  <CircleCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14">
          <h3 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <Diamond />
            مراحل التنفيذ
          </h3>
          <ol className="mt-6 grid gap-6 md:grid-cols-4">
            {INITIATIVE.phases.map((p, i) => (
              <li key={p.title} className="relative">
                {i < INITIATIVE.phases.length - 1 ? (
                  <span aria-hidden="true" className="absolute start-12 top-[18px] hidden h-0.5 w-[calc(100%-1.5rem)] bg-line md:block" />
                ) : null}
                <span
                  className={cn(
                    "t-figure relative flex size-9 items-center justify-center rounded-full border-2 text-sm",
                    i === 0 ? "border-primary bg-primary text-primary-ink" : "border-accent bg-accent-soft text-accent-ink",
                  )}
                >
                  {toArabicDigits(i + 1)}
                </span>
                <p className="mt-3 font-bold text-ink">{p.title}</p>
                <p className="mt-1 text-sm leading-[1.8] text-ink-muted">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-canvas p-5">
            <p className="text-sm font-bold text-accent-ink">المستفيدون</p>
            <p className="mt-1.5 text-sm leading-[1.85] text-ink-muted">{INITIATIVE.beneficiaries}</p>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-5">
            <p className="text-sm font-bold text-accent-ink">الأثر المتوقع</p>
            <p className="mt-1.5 text-sm leading-[1.85] text-ink-muted">{INITIATIVE.impact}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── How supervision works ───────── */

export function HowSection() {
  return (
    <section aria-labelledby="how-title" id="how" className="scroll-mt-28">
      <div className={cn(WRAP, "py-16")}>
        <SectionHead id="how-title" eyebrow="رحلة الطلب" title="كيف يعمل الإشراف الفني" lead="دورة عمل واحدة واضحة لكل طلب، من التقديم حتى القرار، مسجلة ومؤرشفة في المنصة." />
        <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SUPERVISION_STEPS.map((s, i) => {
            const Icon = STEP_ICONS[s.icon];
            return (
              <li key={s.title} className="relative rounded-xl border border-line bg-surface p-6 shadow-1">
                <span className="t-figure absolute end-5 top-4 text-[2.75rem] leading-none text-accent/25">{toArabicDigits(i + 1)}</span>
                <span className="flex size-11 items-center justify-center rounded-md bg-band text-band-gold">
                  <Icon aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-[1.0625rem] font-bold text-brand-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-[1.85] text-ink-muted">{s.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ───────── Closing call to action ───────── */

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className={cn(WRAP, "pb-16")}>
      <div className="band-scope relative overflow-hidden rounded-2xl bg-band px-8 py-10 text-band-ink md:px-12">
        <GeometricPattern size={72} />
        <ArchOutline strokeWidth={5} className="absolute -bottom-20 end-6 w-56 text-band-gold/20" />
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <Logo tone="onDark" height={84} className="hidden sm:block" />
            <div>
              <h2 id="cta-title" className="text-2xl font-bold">الجمعيات المعتمدة في خدمة قاصدي الحرمين الشريفين</h2>
              <p className="mt-2 max-w-xl text-band-ink-muted">سجّلوا جمعيتكم لتنضم إلى منظومة خدمة قاصدي الحرمين الشريفين، أو ادخلوا بحساباتكم لتقديم طلباتكم ومتابعتها.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={buttonClasses("gold", "lg")}>
              سجّلوا جمعيتكم
              <ArrowLeft aria-hidden="true" />
            </Link>
            <Link href="/login" className={buttonClasses("outlineOnBand", "lg")}>
              <LogIn aria-hidden="true" />
              الدخول إلى المنصة
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
