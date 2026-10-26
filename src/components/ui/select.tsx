import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

/** Native select styled like <Input>. Native keeps keyboard and screen-reader behaviour for free. */
export function Select({
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[]; placeholder?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-line-strong bg-surface ps-3 pe-9 text-sm text-ink",
          "transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 aria-[invalid=true]:border-danger",
          "disabled:bg-surface-muted disabled:text-ink-subtle",
        )}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
      />
    </div>
  );
}
