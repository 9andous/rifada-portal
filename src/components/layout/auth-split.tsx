import type { ReactNode } from "react";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { ThemeToggle } from "./theme-toggle";

/**
 * Split screen for login and password pages (docs/DESIGN.md: Login). The form panel sits on the
 * reading side (start); the green panel with the pattern, white logo and the unit's name sits on
 * the end side. Below lg the green panel collapses into a band at the top.
 */
export function AuthSplit({
  title,
  description,
  topActions,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Extra controls next to the theme toggle, e.g. sign out on the password-change page. */
  topActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col">
        <div className="relative overflow-hidden bg-band px-6 py-6 lg:hidden">
          <GeometricPattern />
          <div className="relative flex items-center justify-between">
            <Logo tone="onDark" height={48} priority />
            <div className="flex items-center gap-1">
              {topActions}
              <ThemeToggle tone="band" />
            </div>
          </div>
        </div>

        <div className="hidden items-center justify-between px-10 pt-8 lg:flex xl:px-16">
          <p className="text-sm font-bold text-ink">{brand.productName}</p>
          <div className="flex items-center gap-1">
            {topActions}
            <ThemeToggle />
          </div>
        </div>

        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
          <h1 className="t-page">{title}</h1>
          <span aria-hidden="true" className="mt-3 block h-[2px] w-12 bg-accent" />
          {description ? <p className="t-body mt-4">{description}</p> : null}
          <div className="mt-8">{children}</div>
        </main>

        <p className="t-caption px-6 pb-6 lg:px-10 xl:px-16">{brand.presidencyName}</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-band text-on-band lg:block" aria-label={brand.unitName}>
        <GeometricPattern size={120} />
        <div className="relative flex h-full flex-col justify-between p-14 xl:p-16">
          <Logo tone="onDark" height={96} priority />
          <div className="max-w-lg">
            <span aria-hidden="true" className="block h-[2px] w-16 bg-gold-on-band" />
            <p className="mt-6 text-[2.125rem] font-bold leading-[1.45]">{brand.unitName}</p>
          </div>
          <p className="text-sm text-on-band-muted">{brand.presidencyName}</p>
        </div>
      </aside>
    </div>
  );
}
