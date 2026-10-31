"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { useResultToast } from "./toaster";

/**
 * useActionState for long admin forms. React resets a `<form action>` after every submission,
 * which would clear what the admin typed when the server refuses a value; submitting through
 * `onSubmit` keeps the fields as they are.
 */
export function useActionForm<S extends object>(action: (state: S, formData: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial as Awaited<S>);
  // A successful save, creation or update is confirmed with a toast (D-111).
  useResultToast(state as { ok?: boolean; message?: string });
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }
  return { state, onSubmit, pending };
}
