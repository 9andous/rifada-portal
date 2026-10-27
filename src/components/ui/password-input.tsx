"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./field";

/**
 * Password field with a show/hide toggle. The field is left-to-right like every password input,
 * so the wrapper is too, and the toggle sits at the end of the typed text.
 */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div dir="ltr" className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pe-10", className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        aria-pressed={shown}
        aria-controls={props.id}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-ink-subtle transition-colors hover:text-ink focus-visible:text-primary"
      >
        {shown ? <EyeOff aria-hidden="true" className="size-4" strokeWidth={1.75} /> : <Eye aria-hidden="true" className="size-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}
