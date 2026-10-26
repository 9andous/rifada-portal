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
      after={
        <div className="grid gap-3">
          <Link
            href="/register"
            className="group flex items-center gap-4 rounded-2xl border border-accent/35 bg-accent-soft/70 p-5 transition-[border-color,box-shadow] hover:border-accent hover:shadow-2"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold-action text-on-gold-action">
              <Building2 aria-hidden="true" className="size-6" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">جمعية جديدة؟ سجّلوا جمعيتكم في المنصة</span>
              <span className="mt-0.5 block text-sm text-ink-muted">للجمعيات الخيرية والتطوعية العاملة في خدمة قاصدي الحرمين الشريفين.</span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0 text-accent-ink transition-transform group-hover:-translate-x-1" />
          </Link>
          <Link href="/register/status" className="inline-flex items-center justify-center gap-2 py-1 text-sm font-medium text-primary hover:underline">
            <SearchCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />
            متابعة طلب تسجيل جمعية
          </Link>
        </div>
      }
    >
      <LoginForm />
    </AuthSplit>
  );
}
