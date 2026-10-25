import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSplit } from "@/components/layout/auth-split";
import { Alert, Skeleton } from "@/components/ui/surface";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "تعيين كلمة مرور جديدة" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthSplit title="تعيين كلمة مرور جديدة">
      <Suspense fallback={<Skeleton className="h-48" />}>
        <ResetBody searchParams={searchParams} />
      </Suspense>
    </AuthSplit>
  );
}

async function ResetBody({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token, error } = await searchParams;
  if (typeof token !== "string" || error) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">رابط إعادة التعيين غير صالح أو انتهت صلاحيته.</Alert>
        <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
          طلب رابط جديد
        </Link>
      </div>
    );
  }
  return <ResetForm token={token} />;
}
