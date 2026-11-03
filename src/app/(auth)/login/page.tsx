import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, SearchCheck } from "lucide-react";
import { AuthSplit } from "@/components/layout/auth-split";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <AuthSplit
      title="تسجيل الدخول"
      description="ادخل بحسابك لمتابعة طلباتك ومهامك."
      panel={
        // The registration entry sits in the green panel on wide screens, so the card's column
        // stays short enough for the page to fit a laptop screen without scrolling.
        <div className="grid gap-3">
          <Link
            href="/register"
            className="group flex items-center gap-4 rounded-xl border border-band-gold/50 bg-white/[0.16] p-4 backdrop-blur-sm transition-colors hover:border-band-gold hover:bg-white/[0.22]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-band-gold text-band">
              <Building2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">جمعية جديدة؟ سجّلوا جمعيتكم في المنصة</span>
              <span className="mt-0.5 block text-sm text-band-ink-muted">للجمعيات الخيرية والتطوعية العاملة في خدمة قاصدي الحرمين الشريفين.</span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0 text-band-gold transition-[translate] group-hover:-translate-x-1" />
          </Link>
          <Link
            href="/register/status"
            className="group flex items-center gap-4 rounded-xl border border-white/20 bg-white/[0.08] p-4 backdrop-blur-sm transition-colors hover:border-band-gold hover:bg-white/[0.12]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-band-gold/50 text-band-gold">
              <SearchCheck aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">سجّلتم جمعيتكم؟ تابعوا طلب التسجيل</span>
              <span className="mt-0.5 block text-sm text-band-ink-muted">اعرفوا حالة طلب تسجيل جمعيتكم ونتيجة مراجعته.</span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0 text-band-gold transition-[translate] group-hover:-translate-x-1" />
          </Link>
        </div>
      }
      after={
        <div className="grid gap-3 lg:hidden">
          <Link
            href="/register"
            className="card-link group flex items-center gap-4 rounded-xl border border-accent/35 bg-accent-soft/70 p-5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold-action text-on-gold-action">
              <Building2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">جمعية جديدة؟ سجّلوا جمعيتكم في المنصة</span>
              <span className="mt-0.5 block text-sm text-ink-muted">للجمعيات الخيرية والتطوعية العاملة في خدمة قاصدي الحرمين الشريفين.</span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0 text-accent-ink transition-[translate] group-hover:-translate-x-1" />
          </Link>
          <Link
            href="/register/status"
            className="card-link group flex items-center gap-4 rounded-xl border border-line bg-surface p-5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-accent/50 text-accent-ink">
              <SearchCheck aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">سجّلتم جمعيتكم؟ تابعوا طلب التسجيل</span>
              <span className="mt-0.5 block text-sm text-ink-muted">اعرفوا حالة طلب تسجيل جمعيتكم ونتيجة مراجعته.</span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0 text-accent-ink transition-[translate] group-hover:-translate-x-1" />
          </Link>
        </div>
      }
    >
      <LoginForm />
    </AuthSplit>
  );
}
