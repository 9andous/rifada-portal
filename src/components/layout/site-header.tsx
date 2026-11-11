import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";

/**
 * White header of every page (docs/DESIGN.md: App shell). The logo and the unit's name lead at the
 * start as the platform's identity (D-133); utilities (theme, user, sign in or out) follow at the end. The
 * Presidency's logo lives in the public footer (owner's request, 2026-10-28). It spans the full
 * width of the screen; page content stays at 1360px. `leading` holds the drawer button on narrow
 * screens.
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
          {/* With section links (from xl), the name shifts down to sit on their line. */}
          <span className={`hidden text-[1.0625rem] font-bold leading-snug text-brand-ink lg:block ${middle ? "xl:translate-y-3" : ""}`}>{brand.unitShortName}</span>
        </Link>
        {middle ? <div className="hidden min-w-0 flex-1 xl:block">{middle}</div> : null}
        <div className="ms-auto flex items-center gap-1.5">{children}</div>
      </div>
    </header>
  );
}

/** Hairline between header utilities. */
export function HeaderDivider() {
  return <span aria-hidden="true" className="mx-1.5 hidden h-7 w-px bg-line sm:block" />;
}
