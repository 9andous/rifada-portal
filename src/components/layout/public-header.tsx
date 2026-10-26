import Link from "next/link";
import { Building2, LogIn } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { GovBar } from "./gov-bar";
import { SiteHeader } from "./site-header";
import { ThemeToggle } from "./theme-toggle";

const SECTIONS = [
  { label: "المبادرة", href: "/#initiative" },
  { label: "الرؤية والرسالة", href: "/#vision" },
  { label: "القيم", href: "/#values" },
  { label: "الأهداف", href: "/#objectives" },
  { label: "البرامج", href: "/#programs" },
];

/** Gov banner and header of the public pages, with in-page section links on wide screens. */
export function PublicHeader() {
  return (
    <>
      <GovBar />
      <SiteHeader>
        <nav aria-label="أقسام الصفحة" className="me-2 hidden 2xl:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
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
