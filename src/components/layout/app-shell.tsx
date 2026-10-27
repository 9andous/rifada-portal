import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { ForbiddenState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { NAV, NAV_CTA } from "@/config/nav";
import { initials } from "@/lib/images";
import { requireRole } from "@/server/auth/session";
import { ROLE_HOME, ROLE_LABELS, ROLES, type Role } from "@/server/authz/roles";
import { GovBar } from "./gov-bar";
import { MobileNav } from "./mobile-nav";
import { NavIcon } from "./nav-icon";
import { PageBand } from "./page-band";
import { SignOutButton } from "./sign-out-button";
import { AppFooter } from "./site-footer";
import { HeaderDivider, SiteHeader } from "./site-header";
import { ThemeToggle } from "./theme-toggle";
import { TopNav, TopNavView } from "./top-nav";

/**
 * Logged-in layout for one role area (docs/DESIGN.md: App shell): gov banner, white header with
 * both logos and the user, the green navigation bar, then each page's <PageBand> head and body.
 * Session-dependent parts stream in behind Suspense and are authorized on the server.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const root = ROLE_HOME[role];
  const cta = NAV_CTA[role];

  return (
    <div className="flex min-h-dvh flex-col">
      <GovBar />
      {/* The white header and the green navigation bar stay at the top together on scroll. */}
      <div data-print="hide" className="sticky top-0 z-30">
        <SiteHeader
          sticky={false}
          href={root}
          leading={
            // The drawer reads the URL; on dynamic routes it is unknown while prerendering.
            <Suspense fallback={<span aria-hidden="true" className="size-[42px] lg:hidden" />}>
              <MobileNav items={NAV[role]} root={root} roleLabel={ROLE_LABELS[role]} />
            </Suspense>
          }
        >
          <ThemeToggle />
          <HeaderDivider />
          <Suspense fallback={<span className="mx-2 h-[46px] w-40 animate-pulse rounded-lg bg-surface-sunken" />}>
            <UserChip />
          </Suspense>
          <SignOutButton />
        </SiteHeader>

        <nav data-print="hide" aria-label="التنقل الرئيسي" className="band-scope relative hidden overflow-hidden bg-band text-band-ink lg:block">
          <GeometricPattern size={56} />
          <div className="relative flex h-16 items-stretch gap-4 px-8">
            <Suspense fallback={<TopNavView items={NAV[role]} root={root} pathname={null} className="h-full" />}>
              <TopNav items={NAV[role]} root={root} className="h-full" />
            </Suspense>
            {cta?.href ? (
              <div className="ms-auto flex items-center">
                <Link href={cta.href} className={buttonClasses("gold", "lg", "h-11! px-5 text-[0.9375rem] xl:text-base")}>
                  <NavIcon name={cta.icon} />
                  {cta.label}
                </Link>
              </div>
            ) : null}
          </div>
        </nav>
      </div>

      <main id="main" className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <AreaGuard role={role}>{children}</AreaGuard>
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}

async function AreaGuard({ role, children }: { role: Role; children: ReactNode }) {
  const user = await requireRole([role]);
  if (!user) {
    return (
      <>
        <PageBand title="غير مصرح" compact />
        <PageBody>
          <ForbiddenState />
        </PageBody>
      </>
    );
  }
  return children;
}

async function UserChip() {
  const user = await requireRole(ROLES);
  if (!user) return null;
  // When the account's name is its role («مدير النظام»), show the username instead of repeating it.
  const subtitle = user.associationName ?? ROLE_LABELS[user.role];
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface py-1 pe-3.5 ps-1 shadow-1">
      <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-band text-xs font-bold text-band-gold ring-2 ring-band-gold/40">
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a private, signed-in-only image
          <img src={user.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          initials(user.name)
        )}
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block max-w-48 truncate text-sm font-bold text-ink">{user.name}</span>
        <span className="block max-w-48 truncate text-xs text-ink-subtle">
          {subtitle !== user.name ? subtitle : user.username ? <bdi dir="ltr">@{user.username}</bdi> : null}
        </span>
      </span>
    </div>
  );
}

/** Content area below the page head. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`fade-up fade-up-2 mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 pt-6 sm:px-8 ${className ?? ""}`}>{children}</div>;
}

/** Head skeleton shared by page and list loading states. */
export function HeadSkeleton({ figures = 4, compact }: { figures?: number; compact?: boolean }) {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className={`px-4 sm:px-8 ${compact ? "pb-5 pt-5" : "pb-6 pt-7"}`}>
          <span className="block h-4 w-40 animate-pulse rounded-sm bg-surface-sunken" />
          <span className="mt-3 block h-9 w-80 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
        </div>
      </div>
      {figures ? (
        <div className="mx-auto grid max-w-[1360px] grid-cols-2 gap-3.5 px-4 pt-6 sm:grid-cols-4 sm:px-8">
          {Array.from({ length: figures }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <HeadSkeleton />
      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageBody>
    </div>
  );
}
