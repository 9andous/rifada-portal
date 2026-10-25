"use client";

import { useState } from "react";
import { formatHijri } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Input } from "./field";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** «الموافق ١٢ رجب ١٤٤٨ هـ» for a YYYY-MM-DD value, or null. */
export function hijriCaption(value: string): string | null {
  if (!DATE_ONLY.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : `الموافق ${formatHijri(date)}`;
}

/**
 * A Gregorian date picker (the browser's own) with the Hijri date shown beside it as the user picks
 * (D-044 pattern). The value is submitted as YYYY-MM-DD.
 */
export function HijriDateInput({
  id,
  name,
  defaultValue = "",
  invalid,
  describedBy,
  className,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const caption = hijriCaption(value);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <Input
        id={id}
        name={name}
        type="date"
        dir="ltr"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="w-44"
      />
      <span className="t-caption" aria-live="polite">
        {caption ?? "يظهر التاريخ الهجري عند اختيار التاريخ"}
      </span>
    </div>
  );
}
