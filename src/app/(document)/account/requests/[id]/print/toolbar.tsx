"use client";

import { ArrowRight, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";

/** Screen-only bar above the document: back, and print or save as PDF (the browser's dialog). */
export function DocumentToolbar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div data-print="hide" className="sticky top-0 z-10 border-b border-[#ccc] bg-white">
      <div className="mx-auto flex w-[210mm] max-w-full items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => router.back()} className={buttonClasses("outline", "md")}>
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          رجوع
        </button>
        <p className="min-w-0 flex-1 truncate text-sm text-[#333]">{title || "طلب بلا عنوان"}</p>
        <button type="button" onClick={() => window.print()} className={buttonClasses("primary", "md")}>
          <Printer aria-hidden="true" strokeWidth={1.75} />
          طباعة / حفظ PDF
        </button>
      </div>
    </div>
  );
}
