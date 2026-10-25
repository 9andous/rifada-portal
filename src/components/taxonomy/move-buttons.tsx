"use client";

import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import type { AdminFormState } from "@/server/actions/admin/state";

/** Move-up / move-down icon buttons (the owner chose these over drag and drop). Each move saves at once and is audited. */
export function MoveButtons({
  id,
  label,
  first,
  last,
  move,
}: {
  id: string;
  /** Used in the accessible names, e.g. «الهدف ٣». */
  label: string;
  first: boolean;
  last: boolean;
  move: (id: string, direction: "up" | "down") => Promise<AdminFormState>;
}) {
  const [pending, start] = useTransition();
  const cell = "inline-flex size-8 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <span className="inline-flex items-center">
      {pending ? (
        <LoaderCircle aria-label="جارٍ الحفظ" className="size-4 animate-spin text-ink-subtle" />
      ) : (
        <>
          <button type="button" className={cn(cell)} disabled={first} aria-label={`نقل ${label} إلى الأعلى`} onClick={() => start(async () => void (await move(id, "up")))}>
            <ChevronUp aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </button>
          <button type="button" className={cn(cell)} disabled={last} aria-label={`نقل ${label} إلى الأسفل`} onClick={() => start(async () => void (await move(id, "down")))}>
            <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </button>
        </>
      )}
    </span>
  );
}
