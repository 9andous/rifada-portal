"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, UNAVAILABLE_HINT, type NavItem } from "@/config/nav";
import { cn } from "@/lib/cn";

type TopNavProps = { items: NavItem[]; root: string; className?: string };

/** Primary navigation inside the green band. Active item: white text and a gold underline. */
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
      <ul className="flex items-stretch gap-7">
        {items.map((item) => {
          const active = Boolean(item.href) && item.href === activeHref;
          const base = "relative flex h-full items-center whitespace-nowrap text-[0.9375rem] transition-colors";
          if (!item.href) {
            return (
              <li key={item.label}>
                <span aria-disabled="true" title={UNAVAILABLE_HINT} className={cn(base, "cursor-default text-on-band-muted/60")}>
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
                  "focus-visible:outline-gold-on-band",
                  active ? "font-bold text-on-band" : "text-on-band-muted hover:text-on-band",
                )}
              >
                {item.label}
                {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-gold-on-band" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
