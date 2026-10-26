"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export const THEME_STORAGE_KEY = "rifada-theme";

/**
 * Runs before first paint (see ThemeScript in the root layout) so the stored theme is applied
 * without a flash. Light is the default.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

/** "band" for the green band, "surface" elsewhere. */
export function ThemeToggle({ className, tone = "surface" }: { className?: string; tone?: "band" | "surface" }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (next === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex size-[42px] items-center justify-center rounded-md transition-colors [&_svg]:size-5",
        tone === "band"
          ? "text-band-ink-muted hover:bg-white/10 hover:text-band-ink focus-visible:outline-band-gold"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        className,
      )}
      aria-label="تبديل المظهر بين الفاتح والداكن"
      title="تبديل المظهر"
    >
      <Moon className="dark:hidden" aria-hidden="true" />
      <Sun className="hidden dark:block" aria-hidden="true" />
    </button>
  );
}
