import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/auth-split";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

// Associations no longer register themselves (D-130), so the green panel shows its feature tiles
// instead of the registration entries.
export default function LoginPage() {
  return (
    <AuthSplit title="تسجيل الدخول" description="ادخل بحسابك لمتابعة طلباتك ومهامك.">
      <LoginForm />
    </AuthSplit>
  );
}
