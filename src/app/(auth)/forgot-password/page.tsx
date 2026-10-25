import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/auth-split";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "استعادة كلمة المرور" };

export default function ForgotPasswordPage() {
  return (
    <AuthSplit
      title="استعادة كلمة المرور"
      description="أدخل اسم المستخدم، وسنرسل رابط إعادة التعيين إلى البريد الإلكتروني المسجل في الحساب."
    >
      <ForgotForm />
    </AuthSplit>
  );
}
