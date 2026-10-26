import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, PresidencyLogo } from "@/components/brand/logo";
import { brand } from "@/config/brand";

/**
 * White header of every page (docs/DESIGN.md: App shell). The platform's identity (Rifada logo and
 * system name) leads at the start; utilities (theme, user, sign in or out) follow at the end, and
 * the Presidency's logo closes the header on the far side with its own clear space, so the two
 * marks no longer compete. It spans the full width of the screen; page content stays at 1360px.
 * `leading` holds the drawer button on narrow screens.
 */
export function SiteHeader({
  href = "/",
  leading,
  middle,
  children,
  sticky = true,
}: {
  href?: string;
  leading?: ReactNode;
  /** Fills the space between the identity and the utilities (the public pages' section links). */
  middle?: ReactNode;
  children?: ReactNode;
  /** Off when a parent keeps the header and the navigation bar stuck together (AppShell). */
  sticky?: boolean;
}) {
  return (
    <header data-print="hide" className={sticky ? "sticky top-0 z-30 border-b border-line bg-surface" : "border-b border-line bg-surface"}>
      <div className="flex h-[72px] items-center gap-3 px-4 sm:h-[88px] sm:gap-5 sm:px-8">
        {leading}
        <Link href={href} className="flex min-w-0 items-center gap-3.5">
          <Logo height={52} priority />
          <span className="hidden leading-snug lg:block">
            <span className="block text-[1.0625rem] font-bold text-brand-ink">{brand.systemName}</span>
            <span className="block text-xs text-ink-subtle">الوحدة الإشرافية على المنظمات غير الربحية</span>
          </span>
        </Link>
        {middle ? <div className="hidden min-w-0 flex-1 xl:block">{middle}</div> : null}
        <div className="ms-auto flex items-center gap-1.5">{children}</div>
        <span aria-hidden="true" className="hidden h-12 w-px bg-line md:block" />
        {/* Wrapped: cn() does not merge classes, so `hidden` on the logo itself loses to its inline-flex. */}
        <span className="hidden shrink-0 sm:inline-flex md:ms-1">
          <PresidencyLogo height={44} priority />
        </span>
      </div>
    </header>
  );
}

/** Hairline between header utilities. */
export function HeaderDivider() {
  return <span aria-hidden="true" className="mx-1.5 hidden h-7 w-px bg-line sm:block" />;
}
