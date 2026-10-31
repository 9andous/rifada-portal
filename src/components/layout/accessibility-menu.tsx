"use client";

import { Moon, Sun } from "lucide-react";
import { Popover } from "radix-ui";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { TextSizeControl } from "./text-size";
import { setTheme } from "./theme-toggle";

/** The handoff's «access» glyph (a person with open arms), drawn like the lucide icons. */
function AccessIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 8l8 1.5L20 8M12 9.5V14M8 22l4-8 4 8" />
    </svg>
  );
}

export const CONTRAST_STORAGE_KEY = "rifada-contrast";

/** Runs before first paint (root layout), so high contrast never flashes off. */
export const contrastInitScript = `try{if(localStorage.getItem("${CONTRAST_STORAGE_KEY}")==="high")document.documentElement.dataset.contrast="high"}catch(e){}`;

function setContrast(high: boolean) {
  const root = document.documentElement;
  if (high) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  try {
    localStorage.setItem(CONTRAST_STORAGE_KEY, high ? "high" : "normal");
  } catch {
    // Storage may be unavailable (private mode); the setting still applies to this page view.
  }
}

function subscribeRoot(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
  return () => observer.disconnect();
}

const SEG_TEXT = "flex h-9 items-center justify-center rounded-sm px-3 text-[0.8125rem] font-semibold transition-colors";

const SEG = "flex items-center rounded-md border border-line bg-surface-muted p-0.5";
const SEG_BUTTON = "flex h-9 min-w-9 items-center justify-center rounded-sm px-2 transition-colors [&_svg]:size-4";

/**
 * «أدوات سهولة الوصول» (design handoff, header `.pop`): the access icon opens a panel with the text
 * size, high contrast (tokens.css, D-107) and the theme (owner's request, 2026-10-28). There is no
 * language switch (Arabic only).
 */
export function AccessibilityMenu() {
  const theme = useSyncExternalStore(subscribeRoot, () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"), () => null);
  const high = useSyncExternalStore(subscribeRoot, () => document.documentElement.dataset.contrast === "high", () => null);

  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex size-[42px] items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink data-[state=open]:bg-surface-sunken data-[state=open]:text-ink [&_svg]:size-5"
        aria-label="أدوات سهولة الوصول"
        title="أدوات سهولة الوصول"
      >
        <AccessIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content dir="rtl" align="center" sideOffset={8} collisionPadding={16} className="z-50 w-[280px] rounded-xl border border-line bg-surface p-3.5 text-ink shadow-3">
          <p className="mb-2.5 text-[0.9375rem] font-bold">أدوات سهولة الوصول</p>
          <div className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
            حجم الخط
            <TextSizeControl showLabel={false} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
            التباين العالي
            <div role="group" aria-label="التباين العالي" className={SEG}>
              {(
                [
                  [true, "تشغيل"],
                  [false, "إيقاف"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setContrast(value)}
                  aria-pressed={high === value}
                  className={cn(SEG_TEXT, high === value ? "bg-surface text-primary shadow-1" : "text-ink-muted hover:text-ink")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
            الوضع
            <div role="group" aria-label="الوضع" className={SEG}>
              {(
                [
                  ["light", "فاتح", Sun],
                  ["dark", "داكن", Moon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  aria-label={`الوضع: ${label}`}
                  title={`الوضع: ${label}`}
                  className={cn(SEG_BUTTON, theme === value ? "bg-surface text-primary shadow-1" : "text-ink-muted hover:text-ink")}
                >
                  <Icon aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
