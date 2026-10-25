import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { Logo } from "@/components/brand/logo";
import { NAV_HEIGHT } from "@/components/layout/page-band";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Signed-in pages outside a role area (403). Same green band as the app shell, without navigation. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="relative overflow-hidden bg-band text-on-band" style={{ height: NAV_HEIGHT }}>
        <GeometricPattern />
        <div className="relative mx-auto flex h-full max-w-[1280px] items-center justify-between px-6 lg:px-10">
          <Logo tone="onDark" height={42} />
          <div className="flex items-center gap-1">
            <ThemeToggle tone="band" />
            <SignOutButton variant="band" />
          </div>
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
