"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, UNAVAILABLE_HINT, type NavItem } from "@/config/nav";
import { cn } from "@/lib/cn";
import { NavIcon } from "./nav-icon";

type TopNavProps = { items: NavItem[]; root: string; className?: string };

/** Primary navigation on the green bar. Active item: white text and a 4px gold bar underneath. */
export function TopNav(props: TopNavProps) {
  return <TopNavView {...props} pathname={usePathname()} />;
}

/**
 * The navigation for a known pathname. With `pathname` null (the Suspense fallback while a dynamic
 * route's URL is not known during prerendering) no item is marked active.
 */
export function TopNavView({ items, root, className, pathname }: TopNavProps & { pathname: string | null }) {
  const activeHref = activeNavHref(items, root, pathname);
  return (
    <nav aria-label="القائمة الرئيسية" className={className}>
      <ul className="flex h-full items-stretch gap-0.5">
        {items.map((item) => {
          const active = Boolean(item.href) && item.href === activeHref;
          const base = "relative flex h-full items-center gap-2.5 whitespace-nowrap px-4 text-[0.9375rem] font-medium transition-colors [&_svg]:size-[18px]";
          if (!item.href) {
            return (
              <li key={item.label}>
                <span aria-disabled="true" title={UNAVAILABLE_HINT} className={cn(base, "cursor-default text-band-ink/45")}>
                  <NavIcon name={item.icon} />
                  {item.label}
                </span>
              </li>
            );
          }
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  "focus-visible:outline-band-gold focus-visible:-outline-offset-4",
                  active ? "text-band-ink" : "text-band-ink/80 hover:bg-white/[0.06] hover:text-band-ink",
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
                {active ? <span aria-hidden="true" className="absolute inset-x-3.5 bottom-0 h-1 rounded-t bg-band-gold" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
