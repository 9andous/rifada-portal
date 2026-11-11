"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { RefNumber } from "@/components/ui/ref-number";

/** The request number, large, with a copy button: shown when the association sends a request. */
export function ReferenceCard({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // The number stays on screen to copy by hand.
    }
  }
  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      <span className="text-xs text-ink-subtle">رقم الطلب</span>
      <span className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft/50 px-4 py-2.5">
        <RefNumber value={value} className="text-xl font-bold tracking-wide text-brand-ink" />
        <button
          type="button"
          onClick={copy}
          aria-label="نسخ رقم الطلب"
          className="inline-flex size-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-sunken hover:text-ink"
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        </button>
      </span>
      <span className="text-sm leading-relaxed" aria-live="polite">
        {copied ? "نُسخ رقم الطلب." : "احتفظوا به لمتابعة الطلب، ويظهر أيضًا في «طلباتي» وصفحة الطلب."}
      </span>
    </div>
  );
}
