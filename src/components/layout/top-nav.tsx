"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, UNAVAILABLE_HINT, type NavItem } from "@/config/nav";
import { cn } from "@/lib/cn";
import { NavIcon } from "./nav-icon";

type TopNavProps = { items: NavItem[]; root: string; className?: string };

/** Primary navigation on the green bar. Active item: white text on a lighter fill and a 4px gold bar underneath. */
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
          // 16px semibold labels on a 64px bar; from 1024 to 1279px the icons hide and the padding
          // tightens so seven items and the call-to-action still fit on one line.
          const base =
            "relative flex h-full items-center gap-2.5 whitespace-nowrap px-3 text-[0.9375rem] font-semibold transition-colors xl:px-4 xl:text-base 2xl:px-5 [&_svg]:hidden [&_svg]:size-[18px] xl:[&_svg]:block";
          if (!item.href) {
            return (
              <li key={item.label}>
                <span aria-disabled="true" title={UNAVAILABLE_HINT} className={cn(base, "cursor-not-allowed text-band-ink/60")}>
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
                  active ? "bg-white/10 text-band-ink" : "text-band-ink/85 hover:bg-white/[0.06] hover:text-band-ink",
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
                {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-band-gold" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
