"use client";

import { ChevronLeft, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/config/nav";

/**
 * Breadcrumbs derived from the navigation: the role's home, the active navigation item, then the
 * current page. Hidden on a role's home page itself.
 */
export function Breadcrumbs({ current }: { current?: string }) {
  const pathname = usePathname();
  let best: { root: string; label: string; href: string } | null = null;
  for (const items of Object.values(NAV)) {
    const root = items[0]?.href;
    if (!root) continue;
    for (const item of items) {
      if (!item.href) continue;
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (!best || item.href.length > best.href.length) best = { root, label: item.label, href: item.href };
      }
    }
  }
  if (!best || pathname === best.root) return null;

  const crumbs: { label: string; href?: string }[] = [];
  if (best.href !== best.root) crumbs.push({ label: best.label, href: pathname === best.href ? undefined : best.href });
  if (pathname !== best.href && current && current !== best.label) crumbs.push({ label: current });

  return (
    <nav aria-label="مسار التنقل" className="mb-3 text-[0.8125rem] text-ink-subtle">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href={best.root} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            <House aria-hidden="true" className="size-3.5" />
            الرئيسية
          </Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.label} className="inline-flex items-center gap-1.5">
            <ChevronLeft aria-hidden="true" className="size-3.5 opacity-60" />
            {c.href ? (
              <Link href={c.href} className="font-medium text-primary hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[32ch] truncate">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
