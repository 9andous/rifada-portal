"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button } from "./button";

/** Submit button showing the form's pending state. Pass `pending` when the form submits via `useActionForm`. */
export function SubmitButton({ children, pendingLabel, pending: pendingProp }: { children: ReactNode; pendingLabel: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
