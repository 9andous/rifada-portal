"use client";

import { Pause, Play, Quote } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";
import { initials } from "@/lib/images";
import type { HeroQuoteStyle } from "@/server/settings/defaults";
import type { HeroQuote } from "@/server/services/public-site";

const INTERVAL_MS = 7000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True when the viewer asked for reduced motion; false on the server. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

type Tone = "band" | "light";

/** Round portrait in a gold ring with an arc beneath, as on the strategy's opening pages. */
function Portrait({ src, name, size, tone }: { src: string | null; name: string; size: number; tone: Tone }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span aria-hidden="true" className={cn("absolute -inset-2 rounded-full border-2", tone === "band" ? "border-band-gold/70" : "border-accent/60")} />
      <span
        aria-hidden="true"
        className={cn("absolute -inset-3.5 rounded-full border-[6px] border-transparent", tone === "band" ? "border-b-band-gold/40" : "border-b-band")}
      />
      {src ? (
        <Image src={src} alt={name} fill sizes={`${size}px`} unoptimized={src.startsWith("/api/")} className="rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded-full bg-band text-[2rem] font-bold text-band-gold">
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function SlideBody({ s, variant }: { s: HeroQuote; variant: HeroQuoteStyle }) {
  const light = variant === "cream";
  const long = s.quote.length > 120;
  return (
    <div className={cn("flex h-full flex-col items-center px-7 pb-7 text-center", light ? "" : "pt-9")}>
      <span className={light ? "-mt-20" : undefined}>
        <Portrait src={s.image} name={s.name} size={light ? 156 : 160} tone={light ? "light" : "band"} />
      </span>
      <Quote aria-hidden="true" className={cn("size-7 -scale-x-100", light ? "mt-6 text-accent" : "mt-7 text-band-gold")} strokeWidth={1.5} />
      <blockquote className={cn("mt-2 font-bold leading-[1.85]", light ? "text-brand-ink" : "text-band-ink", long ? "text-base" : "text-[1.25rem]")}>{s.quote}</blockquote>
      <span aria-hidden="true" className="mt-auto block pt-5" />
      <figcaption className={cn("w-full border-t pt-4", light ? "border-accent/30" : "border-white/15")}>
        {s.honorific ? <span className={cn("block text-xs", light ? "text-ink-subtle" : "text-band-ink-muted")}>{s.honorific}</span> : null}
        <span className={cn("block font-bold", light ? "text-brand-ink" : "text-band-gold")}>{s.name}</span>
        {s.title ? <span className={cn("block text-sm", light ? "text-ink-subtle" : "text-band-ink-muted")}>{s.title}</span> : null}
      </figcaption>
    </div>
  );
}

const FRAME: Record<HeroQuoteStyle, string> = {
  cream: "mt-20 rounded-[20px] bg-accent-soft shadow-2",
  card: "rounded-[20px] border border-band-gold/35 bg-white/[0.06]",
};

/**
 * The leadership statements (managed on /admin/settings/home), one at a time in the hero. Rotates
 * every seven seconds; pauses on hover or focus, on the pause button, and never starts under reduced
 * motion. `variant` is the look the super admin chose: «cream» card or translucent «card».
 */
export function HeroQuotes({ slides, variant, id = "leadership" }: { slides: HeroQuote[]; variant: HeroQuoteStyle; id?: string }) {
  const [active, setActive] = useState(0);
  const reducedMotion = useReducedMotion();
  const [userPaused, setPaused] = useState<boolean | null>(null);
  const [held, setHeld] = useState(false);
  const paused = userPaused ?? reducedMotion;
  const several = slides.length > 1;
  const current = Math.min(active, slides.length - 1);

  useEffect(() => {
    if (paused || held || !several) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [active, paused, held, several, slides.length]);

  return (
    <section
      id={id}
      aria-roledescription={several ? "عرض متتابع" : undefined}
      aria-label="كلمات القيادة"
      className="relative mx-auto w-full max-w-[480px] scroll-mt-28"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
    >
      <div className={cn("relative grid", FRAME[variant])} aria-live={paused ? "polite" : "off"}>
        {slides.map((s, i) => {
          const shown = i === current;
          return (
            <figure
              key={s.id}
              role={several ? "group" : undefined}
              aria-roledescription={several ? "شريحة" : undefined}
              aria-label={several ? `${toArabicDigits(i + 1)} من ${toArabicDigits(slides.length)}` : undefined}
              aria-hidden={!shown}
              inert={!shown}
              className={cn("col-start-1 row-start-1 flex flex-col transition-opacity duration-500", shown ? "opacity-100" : "opacity-0")}
            >
              <SlideBody s={s} variant={variant} />
            </figure>
          );
        })}
      </div>

      {several ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`عرض كلمة ${s.name}`}
              aria-current={i === current}
              className="flex h-8 items-center"
            >
              <span className={cn("block h-1.5 rounded-full transition-all", i === current ? "w-7 bg-band-gold" : "w-1.5 bg-white/35")} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? "تشغيل العرض" : "إيقاف العرض"}
            className="flex size-8 items-center justify-center rounded-full text-band-ink-muted hover:text-band-ink"
          >
            {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
          </button>
        </div>
      ) : null}
    </section>
  );
}
