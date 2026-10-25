"use client";

import { ErrorState } from "@/components/states/states";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-8">
      <ErrorState
        title="تعذّر عرض هذه الصفحة"
        description="حدث خطأ غير متوقع أثناء تحميل البيانات. أعد المحاولة، وإن تكرر الخطأ فتواصل مع مدير النظام."
        action={
          <Button variant="outline" onClick={reset}>
            إعادة المحاولة
          </Button>
        }
      />
    </div>
  );
}
