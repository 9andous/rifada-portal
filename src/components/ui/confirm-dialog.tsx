"use client";

import { LoaderCircle, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

/**
 * Centred confirmation modal (docs/DESIGN.md: confirmation modal). Esc and the close button cancel.
 * `onConfirm` runs a server action; the dialog closes when it resolves.
 */
export function ConfirmDialog({
  trigger,
  triggerVariant = "outline",
  triggerSize = "md",
  triggerLabel,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
}: {
  trigger: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  /** Accessible name when the trigger is an icon only. */
  triggerLabel?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <Dialog.Trigger asChild>
        <Button variant={triggerVariant} size={triggerSize} aria-label={triggerLabel}>
          {trigger}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="fixed inset-x-0 top-1/2 z-50 mx-auto w-[min(92vw,30rem)] -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 shadow-3 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="t-section">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق" disabled={pending}>
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description asChild>
            <div className="t-body mt-3 text-sm">{description}</div>
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={pending}>
                إلغاء
              </Button>
            </Dialog.Close>
            <Button
              variant={confirmVariant}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
