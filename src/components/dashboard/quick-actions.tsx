import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type QuickAction = { label: string; hint: string; href: string; icon: ReactNode; tone?: "green" | "gold" };

/** Row of shortcut tiles under the key figures (design handoff `.qa`). Only real routes. */
export function QuickActions({ items, label = "إجراءات سريعة" }: { items: QuickAction[]; label?: string }) {
  return (
    <nav aria-label={label}>
      <ul className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", items.length >= 6 ? "lg:grid-cols-3 xl:grid-cols-6" : items.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        {items.map((a) => (
          <li key={a.href + a.label}>
            <Link
              href={a.href}
              className="group flex h-full items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-1 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary hover:shadow-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-[42px] shrink-0 items-center justify-center rounded-md [&_svg]:size-5",
                  a.tone === "gold" ? "bg-accent-soft text-accent-ink" : "bg-primary-soft text-primary",
                )}
              >
                {a.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.875rem] font-bold leading-snug text-ink group-hover:text-primary">{a.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-subtle">{a.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
