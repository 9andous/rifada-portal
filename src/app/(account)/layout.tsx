import { GovBar } from "@/components/layout/gov-bar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { AppFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Signed-in pages outside a role area (403). Same header as the app shell, without navigation. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GovBar />
      <SiteHeader href="/dashboard">
        <ThemeToggle />
        <SignOutButton />
      </SiteHeader>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <AppFooter />
    </>
  );
}
