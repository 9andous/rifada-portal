import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSplit } from "@/components/layout/auth-split";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Alert, Skeleton } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { ChangePasswordForm } from "./change-form";

export const metadata: Metadata = { title: "تغيير كلمة المرور" };

export default function ChangePasswordPage() {
  return (
    <AuthSplit title="تغيير كلمة المرور" topActions={<SignOutButton />}>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ChangePasswordBody />
      </Suspense>
    </AuthSplit>
  );
}

async function ChangePasswordBody() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <div className="flex flex-col gap-5">
      {user.mustChangePassword ? (
        <Alert tone="info" title="مطلوب قبل المتابعة">
          لحماية حسابك، يلزم تعيين كلمة مرور جديدة خاصة بك عند الدخول الأول.
        </Alert>
      ) : null}
      <ChangePasswordForm />
    </div>
  );
}
