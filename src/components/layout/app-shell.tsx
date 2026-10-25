import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { ForbiddenState } from "@/components/states/states";
import { Skeleton } from "@/components/ui/surface";
import { NAV } from "@/config/nav";
import { brand } from "@/config/brand";
import { requireRole } from "@/server/auth/session";
import { ROLE_HOME, ROLE_LABELS, ROLES, type Role } from "@/server/authz/roles";
import { MobileNav } from "./mobile-nav";
import { NAV_HEIGHT, PageBand } from "./page-band";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";
import { TopNav, TopNavView } from "./top-nav";

/**
 * Logged-in layout for one role area (docs/DESIGN.md: App shell). The navigation row is the top
 * of the green band; each page continues the band with <PageBand> (title, key figures) which then
 * fades into the ivory page. Session-dependent parts stream in behind Suspense and are authorized
 * on the server.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const root = ROLE_HOME[role];

  return (
    <div className="flex min-h-dvh flex-col">
      <header data-print="hide" className="relative overflow-hidden bg-band text-on-band" style={{ height: NAV_HEIGHT }}>
        <GeometricPattern />
        <div className="relative mx-auto flex h-full max-w-[1280px] items-stretch justify-between gap-6 px-6 lg:px-10">
          <div className="flex items-stretch gap-8">
            <div className="flex items-center gap-2">
              {/* Both navigations read the URL; on dynamic routes it is unknown while prerendering. */}
              <Suspense fallback={<span aria-hidden="true" className="size-9 lg:hidden" />}>
                <MobileNav items={NAV[role]} root={root} roleLabel={ROLE_LABELS[role]} />
              </Suspense>
              <Link href={root} className="flex items-center focus-visible:outline-gold-on-band">
                <Logo tone="onDark" height={42} priority />
                <span className="sr-only">{brand.productName}</span>
              </Link>
            </div>
            <Suspense fallback={<TopNavView items={NAV[role]} root={root} pathname={null} className="hidden lg:flex" />}>
              <TopNav items={NAV[role]} root={root} className="hidden lg:flex" />
            </Suspense>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle tone="band" />
            <Suspense fallback={<span className="mx-2 h-8 w-32 animate-pulse rounded-sm bg-white/10" />}>
              <UserBadge />
            </Suspense>
            <SignOutButton variant="band" />
          </div>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <AreaGuard role={role}>{children}</AreaGuard>
        </Suspense>
      </main>
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

async function UserBadge() {
  const user = await requireRole(ROLES);
  if (!user) return null;
  return (
    <div className="ms-2 flex items-center gap-3 border-s border-white/15 ps-4">
      <div className="hidden text-end leading-tight sm:block">
        <p className="text-sm font-semibold text-on-band">{user.name}</p>
        <p className="text-xs text-on-band-muted">{user.associationName ?? ROLE_LABELS[user.role]}</p>
      </div>
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-full border border-gold-on-band/50 text-sm font-semibold text-gold-on-band"
      >
        {user.name.trim().charAt(0)}
      </span>
    </div>
  );
}

/** Content area below the band. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] flex-1 px-6 pb-16 lg:px-10 ${className ?? ""}`}>{children}</div>;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <div className="band-fade bg-band">
        <div className="mx-auto max-w-[1280px] px-6 pb-10 pt-10 lg:px-10">
          <span className="block h-4 w-40 animate-pulse rounded-sm bg-white/10" />
          <span className="mt-3 block h-9 w-80 animate-pulse rounded-sm bg-white/10" />
          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/12 pt-6 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block h-14 animate-pulse rounded-sm bg-white/10" />
            ))}
          </div>
        </div>
      </div>
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </PageBody>
    </div>
  );
}
