import Link from "next/link";
import { Building2, LogIn } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { GovBar } from "./gov-bar";
import { SectionLink } from "./section-link";
import { SiteHeader } from "./site-header";
import { ThemeToggle } from "./theme-toggle";

// In the order the sections appear on the home page.
const SECTIONS = [
  { label: "القيادة", href: "/#leadership" },
  { label: "الرؤية والرسالة", href: "/#vision" },
  { label: "القيم", href: "/#values" },
  { label: "الأهداف", href: "/#objectives" },
  { label: "المبادرة", href: "/#initiative" },
];

/** Gov banner and header of the public pages, with in-page section links on wide screens. */
export function PublicHeader() {
  return (
    <>
      <GovBar />
      <SiteHeader
        middle={
          // Spread evenly across the empty part of the header, from 1280px.
          <nav aria-label="أقسام الصفحة">
            <ul className="flex items-center justify-evenly gap-2">
              {SECTIONS.map((s) => (
                <li key={s.href}>
                  <SectionLink href={s.href} className="rounded-md px-3 py-2 text-[0.9375rem] font-semibold whitespace-nowrap text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary">
                    {s.label}
                  </SectionLink>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <ThemeToggle />
        <span className="hidden sm:block">
          <Link href="/register" className={buttonClasses("outline", "md")}>
            <Building2 aria-hidden="true" />
            تسجيل جمعية
          </Link>
        </span>
        <Link href="/login" className={buttonClasses("dark", "md", "ms-1")}>
          <LogIn aria-hidden="true" />
          <span className="hidden sm:inline">الدخول إلى المنصة</span>
          <span className="sm:hidden">الدخول</span>
        </Link>
      </SiteHeader>
    </>
  );
}
