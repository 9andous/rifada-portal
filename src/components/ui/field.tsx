import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink",
        "placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-2",
        "aria-[invalid=true]:border-danger disabled:bg-surface-muted disabled:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-ink",
        "placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-2",
        "aria-[invalid=true]:border-danger disabled:bg-surface-muted disabled:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint/error, wired with ids for assistive technology. */
export function Field({ id, label, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
