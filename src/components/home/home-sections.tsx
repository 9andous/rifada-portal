import {
  ArrowLeft,
  Compass,
  Eye,
  LogIn,
  Target,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { brand } from "@/config/brand";
import { INITIATIVE, STRATEGY_MOTTO } from "@/config/initiative";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { HeroQuoteStyle } from "@/server/settings/defaults";
import type { HeroQuote, PublicHome } from "@/server/services/public-site";
import { HeroQuotes } from "./hero-quotes";

const WRAP = "mx-auto w-full max-w-[1360px] px-4 sm:px-8";

function SectionHead({ eyebrow, title, lead, tone = "surface", align = "start", id }: { eyebrow: string; title: string; lead?: ReactNode; tone?: "surface" | "band"; align?: "start" | "center"; id: string }) {
  const band = tone === "band";
  const center = align === "center";
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      <p className={cn("flex items-center gap-2 text-sm font-medium", center && "justify-center", band ? "text-band-gold" : "text-accent-ink")}>
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

/**
 * `quotes`: the leadership statements panel, usually <HeroQuotesPanel> under a Suspense boundary.
 * `figures` (<HeroFigures>) is optional; the home page no longer shows them (owner's request).
 */
export function HomeHero({ figures, quotes }: { figures?: ReactNode; quotes: ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="band-scope relative overflow-hidden bg-band text-band-ink">
      <GeometricPattern size={96} />
      <div className={cn(WRAP, "relative grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20")}>
        <div className="fade-up text-center lg:ps-12">
          <p className="flex items-center justify-center gap-2 text-base font-medium text-band-gold">
            <Diamond className="bg-band-gold" />
            {brand.presidencyName}
          </p>
          <h1 id="hero-title" className="mt-4 text-[2.125rem] font-bold leading-[1.4] md:text-[2.75rem]">
            {brand.unitName}
          </h1>
          <p className="mt-4 text-xl font-semibold text-band-gold">{STRATEGY_MOTTO}</p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-[1.9] text-band-ink-muted">
            {brand.systemName} هي المنصة الرقمية للإشراف الفني على الجمعيات الخيرية والتطوعية التي تخدم قاصدي الحرمين الشريفين: تُقدَّم
            فيها البرامج والمشروعات ضمن برامج الرئاسة، وتُراجع وتُتابع بإجراءات واضحة وموثّقة.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className={buttonClasses("gold", "lg")}>
              <LogIn aria-hidden="true" />
              الدخول إلى المنصة
            </Link>
            <Link href="/register" className={buttonClasses("outlineOnBand", "lg")}>
تسجيل جمعية              <ArrowLeft aria-hidden="true" />
            </Link>
          </div>
          {figures ? <div className="mt-10">{figures}</div> : null}
        </div>

        {quotes}
      </div>
    </section>
  );
}

/** The statements, or the Kaaba photograph in the arch while none is published. */
export function HeroQuotesPanel({ slides, style, id }: { slides: HeroQuote[]; style: HeroQuoteStyle; id?: string }) {
  if (slides.length > 0) return <HeroQuotes slides={slides} variant={style} id={id} />;
  return (
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
  );
}

export function HeroQuotesSkeleton() {
  return <span aria-hidden="true" className="mx-auto mt-16 block h-[440px] w-full max-w-[480px] animate-pulse rounded-[20px] bg-white/[0.06]" />;
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
    <dl className="mx-auto grid max-w-2xl grid-cols-2 gap-y-5 border-t border-white/15 pt-6 text-center sm:grid-cols-4">
      {items.map((f, i) => (
        <div key={f.label} className={cn("flex flex-col items-center px-3", i > 0 && "sm:border-s sm:border-white/15")}>
          <dd className="t-figure text-[2rem] text-band-ink">{formatNumber(f.value)}</dd>
          <dt className="mt-1.5 text-[0.8125rem] text-band-ink-muted">{f.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function HeroFiguresSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto grid max-w-2xl grid-cols-2 gap-5 border-t border-white/15 pt-6 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="block h-16 animate-pulse rounded-sm bg-white/10" />
      ))}
    </div>
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
                  <span className="flex size-9 items-center justify-center rounded-md bg-band-gold/25 text-band-gold backdrop-blur-sm">
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
          {/* The photograph cut to the outer silhouette of the eight-lobed rosary frame (masba7a), with
              the frame drawn over it; the dark variant adds white rings for dark surfaces. */}
          <div className="relative mx-auto mt-8 hidden aspect-[895/880] w-full max-w-[380px] drop-shadow-[0_18px_28px_rgb(7_77_49/0.22)] lg:block">
            <div className="masba7a-mask absolute inset-0">
              <Image
                src="/images/haramain/kaaba-clock-tower.jpg"
                alt="الكعبة المشرفة والطائفون حولها وبرج الساعة في مكة المكرمة"
                fill
                sizes="380px"
                className="object-cover"
              />
            </div>
            <Image src="/brand/masba7a.png" alt="" fill sizes="380px" className="pointer-events-none dark:hidden" />
            <Image src="/brand/masba7aDark.png" alt="" fill sizes="380px" className="pointer-events-none hidden dark:block" />
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
          align="center"
          eyebrow="إلى أين نتجه"
          title="الأهداف الاستراتيجية"
          lead="سبعة أهداف استراتيجية للرئاسة. تخدم مخرجات مبادرة الإشراف الفني أربعة منها مباشرة، وهي المميزة أدناه."
        />
        <ol className="mt-10 flex flex-wrap justify-center gap-4">
          {home.objectives.map((o) => {
            const link = INITIATIVE.objectiveLinks[o.number];
            return (
              <li
                key={o.number}
                className={cn(
                  "flex w-full flex-col items-center rounded-lg border p-5 text-center md:w-[calc(50%-0.5rem)] xl:w-[calc(25%-0.75rem)]",
                  "border-band-gold/40 bg-white/[0.08]",
                )}
              >
                <div className="flex flex-col items-center gap-2.5">
                  <span className="flex size-10 items-center justify-center rounded-md bg-band-gold/15 text-band-gold">
                    <span className="t-figure text-lg text-band-gold">{toArabicDigits(o.number)}</span>
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
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHead id="initiative-title" eyebrow="عن المنصة" title={INITIATIVE.name} lead={INITIATIVE.intro} />
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
          <div className="relative overflow-hidden rounded-2xl">
            <Image
              src="/images/haramain/kaaba-clock-tower.jpg"
              alt="المسجد الحرام والكعبة المشرفة"
              width={745}
              height={746}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="aspect-[4/3] w-full object-cover lg:absolute lg:inset-0 lg:aspect-auto lg:h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
