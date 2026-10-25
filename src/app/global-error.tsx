"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-dvh items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl">تعذّر تحميل المنصة</h1>
          <p className="mt-2 text-sm text-ink-muted">حدث خطأ غير متوقع. أعد المحاولة بعد قليل.</p>
          <button type="button" onClick={reset} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-ink">
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
