import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = { key: string; label: string; href: string; count?: string };

/** Tabs as links (URL state, server-rendered). Active tab: bold ink text with a gold underline. */
export function TabNav({ items, active, label, className }: { items: TabItem[]; active: string; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("border-b border-line", className)}>
      <ul className="flex flex-wrap gap-x-7 px-6">
        {items.map((t) => {
          const current = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center gap-2 py-3.5 text-sm transition-colors",
                  current ? "font-bold text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined ? <span className="t-caption t-figure">{t.count}</span> : null}
                {current ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[3px] bg-accent" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
