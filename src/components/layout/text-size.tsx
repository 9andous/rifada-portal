"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

// Text size for readers who need larger type (D-102). The whole interface is sized in rem, so the
// root font size scales everything: normal 100%, large 112.5%, larger 125% (globals.css). The
// association area opens at «كبير» until the user picks a size; the choice is kept on the device.

export const TEXT_SIZE_STORAGE_KEY = "rifada-text-size";

export const TEXT_SIZES = ["normal", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Runs before first paint (root layout, after the theme script), so a stored size never flashes. */
export const textSizeInitScript = `try{var z=localStorage.getItem("${TEXT_SIZE_STORAGE_KEY}");if(z==="normal"||z==="large"||z==="xlarge")document.documentElement.dataset.textSize=z}catch(e){}`;

const LABELS: Record<TextSize, string> = { normal: "عادي", large: "كبير", xlarge: "أكبر" };
const GLYPH: Record<TextSize, string> = { normal: "text-[0.8125rem]", large: "text-[1.0625rem]", xlarge: "text-[1.3125rem]" };

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-text-size"] });
  return () => observer.disconnect();
}

/** The size in effect: the user's choice, else the area's default. */
function currentSize(): TextSize {
  const chosen = document.documentElement.dataset.textSize as TextSize | undefined;
  if (chosen && (TEXT_SIZES as readonly string[]).includes(chosen)) return chosen;
  return document.querySelector("[data-easy]") ? "large" : "normal";
}

/** «حجم الخط»: three buttons with a growing letter; the pressed one is the size in effect. */
export function TextSizeControl({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const size = useSyncExternalStore(subscribe, currentSize, () => null);

  function choose(next: TextSize) {
    document.documentElement.setAttribute("data-text-size", next);
    try {
      localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the size still applies to this page view.
    }
  }

  return (
    <div role="group" aria-label="حجم الخط" className={cn("flex items-center gap-2", className)}>
      {showLabel ? <span className="text-sm font-semibold text-ink-muted md:hidden 2xl:inline">حجم الخط</span> : null}
      <div className="flex items-center rounded-md border border-line bg-surface-muted p-0.5">
        {TEXT_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => choose(s)}
            aria-pressed={size === s}
            aria-label={`حجم الخط: ${LABELS[s]}`}
            title={`حجم الخط: ${LABELS[s]}`}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-sm px-2 font-bold leading-none transition-colors",
              GLYPH[s],
              size === s ? "bg-surface text-primary shadow-1" : "text-ink-muted hover:text-ink",
            )}
          >
            أ
          </button>
        ))}
      </div>
    </div>
  );
}
