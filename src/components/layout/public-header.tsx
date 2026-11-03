import Link from "next/link";
import { Building2, LogIn } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { AccessibilityMenu } from "./accessibility-menu";
import { GovBar } from "./gov-bar";
import { SectionLink } from "./section-link";
import { SiteHeader } from "./site-header";
import { ThemeToggle } from "./theme-toggle";

// In the order the sections appear on the home page.
const SECTIONS = [
  { label: "القيادة", href: "/#leadership" },
  { label: "الرؤية والرسالة", href: "/#vision" },
  { label: "القيم", href: "/#values" },
  { label: "المبادرة", href: "/#initiative" },
];

/** Gov banner and header of the public pages, with in-page section links on wide screens. */
export function PublicHeader() {
  return (
    <>
      <GovBar />
      <SiteHeader
        middle={
          // Grouped at the start, from 1280px; the start padding lines the first link up with the
          // end of «كيف تتحقق» in the gov banner above, and the shift down sits them on the line of
          // the identity's unit name (owner's request). Hairlines between links.
          <nav aria-label="أقسام الصفحة" className="translate-y-3 ps-36">
            <ul className="flex items-center gap-1">
              {SECTIONS.map((s, i) => (
                <li key={s.href} className="flex items-center gap-1">
                  {i > 0 ? <span aria-hidden="true" className="h-4 w-px bg-line-strong" /> : null}
                  <SectionLink href={s.href} className="rounded-md px-3 py-2 text-[0.9375rem] font-semibold whitespace-nowrap text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary">
                    {s.label}
                  </SectionLink>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <AccessibilityMenu />
        <ThemeToggle />
        <span className="hidden sm:block">
          <Link href="/register" className={buttonClasses("outline", "md")}>
            <Building2 aria-hidden="true" />
            تسجيل جمعية
          </Link>
        </span>
        <Link href="/login" className={buttonClasses("gold", "md", "ms-1")}>
          <LogIn aria-hidden="true" />
          <span className="hidden sm:inline">الدخول إلى المنصة</span>
          <span className="sm:hidden">الدخول</span>
        </Link>
      </SiteHeader>
    </>
  );
}
