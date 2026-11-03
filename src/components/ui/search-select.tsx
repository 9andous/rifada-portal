"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./select";

// Folds the spellings people type interchangeably in Arabic (hamza forms of alef, taa marbuta,
// alef maqsura, tatweel and diacritics) so «مكه» finds «مكة» and «الاحساء» finds «الأحساء».
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/**
 * Dropdown with a search box, styled like <Select>. The list opens below the field and flips above
 * it when there is no room below (Radix collision handling). The value is posted through a hidden
 * input named `name`, so it works in a plain form like the native select.
 */
export function SearchSelect({
  id,
  name,
  options,
  placeholder = "اختر",
  searchPlaceholder = "ابحث…",
  defaultValue = "",
  onValueChange,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  name: string;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = fold(query);
    return q ? options.filter((o) => fold(o.label).includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
  }

  function choose(option: SelectOption) {
    setValue(option.value);
    setOpen(false);
    onValueChange?.(option.value);
  }

  function moveTo(index: number) {
    const i = Math.min(Math.max(index, 0), shown.length - 1);
    setActive(i);
    listRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") moveTo(active + 1);
    else if (event.key === "ArrowUp") moveTo(active - 1);
    else if (event.key === "Home") moveTo(0);
    else if (event.key === "End") moveTo(shown.length - 1);
    else if (event.key === "Enter") {
      if (shown[active]) choose(shown[active]);
    } else return;
    event.preventDefault();
  }

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <input type="hidden" name={name} value={value} />
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "relative flex h-10 w-full items-center rounded-md border border-line-strong bg-surface ps-3 pe-9 text-start text-sm",
            "transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 aria-[invalid=true]:border-danger",
            "data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20",
            "disabled:cursor-not-allowed disabled:bg-surface-muted",
            selected ? "text-ink" : "text-ink-subtle",
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className={cn("pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle transition-transform", open && "rotate-180")}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions
          collisionPadding={{ top: 96, bottom: 16, left: 16, right: 16 }}
          onOpenAutoFocus={(event) => {
            // Focus the search box, not the first option.
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
          className="fade-up z-50 flex max-h-80 w-[var(--radix-popover-trigger-width)] min-w-56 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-3"
        >
          <div className="relative border-b border-line p-2">
            <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute start-4.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
              className="h-9 w-full rounded-md bg-surface-muted ps-8 pe-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="flex-1 overflow-y-auto p-1">
            {shown.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-subtle">لا توجد نتائج مطابقة.</li>
            ) : (
              shown.map((o, i) => (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => choose(o)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                    i === active ? "bg-primary-soft text-ink" : "text-ink-muted",
                    o.value === value && "font-semibold text-primary",
                  )}
                >
                  {o.label}
                  {o.value === value ? <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} /> : null}
                </li>
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
