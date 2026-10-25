import Link from "next/link";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
      <EmptyState
        title="الصفحة غير موجودة"
        description="تعذّر العثور على الصفحة المطلوبة. ربما نُقلت أو أن الرابط غير صحيح."
        action={
          <Link href="/" className={buttonClasses("outline")}>
            الصفحة الرئيسية
          </Link>
        }
      />
    </main>
  );
}
