import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "عن المنصة",
    links: [
      { label: "مبادرة الإشراف الفني", href: "/#initiative" },
      { label: "الرؤية والرسالة", href: "/#vision" },
      { label: "القيم", href: "/#values" },
      { label: "الأهداف الاستراتيجية", href: "/#objectives" },
      { label: "برامج الرئاسة", href: "/#programs" },
    ],
  },
  {
    title: "الخدمات",
    links: [
      { label: "تسجيل جمعية", href: "/register" },
      { label: "متابعة طلب التسجيل", href: "/register/status" },
      { label: "تسجيل الدخول", href: "/login" },
      { label: "استعادة كلمة المرور", href: "/forgot-password" },
      { label: "كيف يعمل الإشراف", href: "/#how" },
    ],
  },
  {
    title: "الرئاسة",
    links: [{ label: "الموقع الرسمي للرئاسة", href: brand.presidencyUrl, external: true }],
  },
];

/** Dark footer of the public pages (docs/DESIGN.md: Footer). */
export function SiteFooter() {
  return (
    <footer data-print="hide" className="mt-auto bg-band-deep text-sm text-band-ink-muted">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-8">
        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo tone="onDark" height={64} />
            <p className="mt-3.5 max-w-xs leading-[1.8]">
              المنصة الرقمية للوحدة الإشرافية على المنظمات غير الربحية العاملة في خدمة قاصدي الحرمين الشريفين.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3.5 text-[0.9375rem] font-bold text-band-ink">{col.title}</h2>
              <ul className="grid gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-band-gold">
                        {l.label}
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">(يفتح في نافذة جديدة)</span>
                      </a>
                    ) : (
                      <Link href={l.href} className="hover:text-band-gold">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <FooterBar />
    </footer>
  );
}

/** Copyright bar; on its own it is the footer of the signed-in screens. */
export function FooterBar({ children }: { children?: ReactNode }) {
  return (
    <div className="border-t border-white/10">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-[0.8125rem] text-band-ink-muted sm:px-8">
        <span>جميع الحقوق محفوظة — {brand.presidencyName}</span>
        {children}
      </div>
    </div>
  );
}

/** Footer of the signed-in screens: the copyright bar only, so data screens stay dense. */
export function AppFooter() {
  return (
    <footer data-print="hide" className="mt-auto bg-band-deep">
      <FooterBar />
    </footer>
  );
}
