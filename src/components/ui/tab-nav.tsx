import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = { key: string; label: string; href: string; count?: string };

/**
 * Tabs as links (URL state, server-rendered). Active tab: green text, 3px green bar, filled count.
 * The tabs share the whole width (owner's review, D-130, as `CardTabs` since D-128); on a narrow
 * screen the row scrolls sideways instead of wrapping.
 */
export function TabNav({ items, active, label, className }: { items: TabItem[]; active: string; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("border-b border-line", className)}>
      <ul className="flex overflow-x-auto px-4 sm:px-5">
        {items.map((t, i) => {
          const current = t.key === active;
          return (
            // A short hairline before every tab but the first separates them (owner's review, D-125).
            <li key={t.key} className={cn("flex min-w-max flex-1 items-center", i > 0 && "before:h-7 before:w-0.5 before:rounded-full before:bg-line-strong before:content-['']")}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3.5 text-sm transition-colors",
                  current ? "font-semibold text-primary" : "font-medium text-ink-muted hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined ? (
                  <span
                    className={cn(
                      "t-figure rounded-full px-2 text-[0.75rem] leading-[18px]",
                      current ? "bg-primary text-primary-ink" : "bg-surface-sunken text-ink-muted",
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
                {current ? <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-[3px] bg-primary" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
