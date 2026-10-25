import Link from "next/link";
import { LogIn } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { ThemeToggle } from "./theme-toggle";

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-4">
          <Logo height={52} priority />
          <span className="hidden border-s border-line ps-4 text-sm leading-snug text-ink-muted md:block">
            <span className="block font-semibold text-ink">{brand.productName}</span>
            الوحدة الإشرافية على المنظمات غير الربحية
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonClasses("primary", "md")}>
            <LogIn aria-hidden="true" />
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-ink-muted">
        <p>{brand.presidencyName}</p>
        <p>{brand.unitName}</p>
      </div>
    </footer>
  );
}
