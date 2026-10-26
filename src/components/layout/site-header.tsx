import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, PresidencyLogo } from "@/components/brand/logo";
import { brand } from "@/config/brand";

/**
 * White header of every page (docs/DESIGN.md: App shell): the Presidency's logo, a hairline, the
 * Rifada logo and the system name at the start; utilities (theme, user, sign in or out) at the end.
 * `leading` holds the drawer button on narrow screens.
 */
export function SiteHeader({ href = "/", leading, children }: { href?: string; leading?: ReactNode; children?: ReactNode }) {
  return (
    <header data-print="hide" className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center gap-3 px-4 sm:h-[84px] sm:gap-5 sm:px-8">
        {leading}
        <Link href={href} className="flex min-w-0 items-center gap-3 sm:gap-[18px]">
          <PresidencyLogo height={46} priority className="hidden sm:inline-flex" />
          <span aria-hidden="true" className="hidden h-11 w-px bg-line sm:block" />
          <Logo height={50} priority />
          <span className="hidden leading-snug xl:block">
            <span className="block text-[1.0625rem] font-bold text-brand-ink">{brand.systemName}</span>
            <span className="block text-xs text-ink-subtle">الوحدة الإشرافية على المنظمات غير الربحية</span>
          </span>
        </Link>
        <div className="ms-auto flex items-center gap-1.5">{children}</div>
      </div>
    </header>
  );
}

/** Hairline between header utilities. */
export function HeaderDivider() {
  return <span aria-hidden="true" className="mx-1.5 hidden h-7 w-px bg-line sm:block" />;
}
