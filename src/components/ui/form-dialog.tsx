"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import type { AdminFormState } from "@/server/actions/admin/state";
import { Button, type ButtonProps } from "./button";
import { SubmitButton } from "./form-bits";
import { Alert } from "./surface";
import { useActionForm } from "./use-action-form";

/**
 * A centred dialog holding a small form (add/edit). It submits a server action, shows field errors
 * in place, and closes itself when the action succeeds. Esc and the close button cancel.
 */
export function FormDialog({
  trigger,
  triggerVariant = "outline",
  triggerSize = "md",
  triggerLabel,
  title,
  description,
  submitLabel,
  action,
  children,
  wide,
}: {
  trigger: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  /** Accessible name when the trigger is an icon only. */
  triggerLabel?: string;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  /** Fields; receives the current field errors. */
  children: (errors: Record<string, string | undefined>) => ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // A new form instance per opening, so a reopened dialog starts clean.
  const [instance, setInstance] = useState(0);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setInstance((n) => n + 1);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant={triggerVariant} size={triggerSize} aria-label={triggerLabel}>
          {trigger}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content
          className={`fixed inset-x-0 top-1/2 z-50 mx-auto max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-sm border border-line bg-surface p-6 shadow-3 focus:outline-none ${wide ? "w-[min(94vw,44rem)]" : "w-[min(92vw,32rem)]"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="t-section">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق">
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description asChild>
              <div className="t-body mt-2 text-sm">{description}</div>
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <DialogForm key={instance} action={action} submitLabel={submitLabel} onDone={() => setOpen(false)}>
            {children}
          </DialogForm>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogForm({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  submitLabel: string;
  onDone: () => void;
  children: (errors: Record<string, string | undefined>) => ReactNode;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-5">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      {children(state.errors ?? {})}
      <div className="flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button variant="ghost" disabled={pending}>
            إلغاء
          </Button>
        </Dialog.Close>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
