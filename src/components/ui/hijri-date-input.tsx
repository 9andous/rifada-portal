"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import {
  formatHijri,
  HIJRI_MONTH_NAMES,
  hijriMonthDays,
  hijriPartsFromIso,
  hijriToday,
  isoPlusDays,
  shiftHijriMonth,
  toArabicDigits,
  type HijriMonth,
} from "@/lib/format";
import { Select } from "./select";

const FIRST_YEAR = 1445;
const LAST_YEAR = 1465;

/** The week starts on Sunday, as on the Saudi calendar. */
const WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const NAV_BUTTON =
  "flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent [&_svg]:size-4";

const dateOf = (iso: string) => new Date(`${iso}T12:00:00Z`);
const monthIndex = (m: HijriMonth) => m.year * 12 + m.month;

/**
 * A Hijri date picked on a calendar (D-134, D-140). Browsers have no Hijri calendar, so it is built
 * here; a hidden input submits the date as YYYY-MM-DD, so storage and the server's rules stay as they
 * are. `min` and `max` (YYYY-MM-DD) disable the dates outside them; the server checks the same rules.
 * `id` goes on the button, so a <label htmlFor> focuses it.
 */
export function HijriDateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  disabled,
  placeholder = "يُرجى اختيار التاريخ",
  invalid,
  describedBy,
  className,
}: {
  id: string;
  name: string;
  /** With `onChange`, makes the field controlled. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const iso = value ?? own;
  const valid = hijriPartsFromIso(iso) !== null;

  function choose(next: string) {
    setOwn(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={iso} />
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          data-invalid={invalid || undefined}
          aria-describedby={cn(valid && `${id}-value`, describedBy) || undefined}
          className={cn(
            "relative flex h-10 w-full min-w-0 items-center rounded-md border border-line-strong bg-surface ps-3 pe-9 text-start text-sm",
            "transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 data-[invalid]:border-danger",
            "data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20",
            "disabled:cursor-not-allowed disabled:bg-surface-muted",
            valid ? "text-ink" : "text-ink-subtle",
            className,
          )}
        >
          <span id={`${id}-value`} className="truncate">
            {valid ? formatHijri(dateOf(iso)) : placeholder}
          </span>
          <CalendarDays aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions
          collisionPadding={{ top: 96, bottom: 16, left: 16, right: 16 }}
          aria-label="التقويم الهجري"
          onOpenAutoFocus={(event) => {
            // The chosen day, or today, rather than the first button.
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus();
          }}
          className="fade-up z-50 max-h-[var(--radix-popover-content-available-height)] w-[23rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-3 shadow-3"
        >
          {/* Mounted on each opening, so it starts at the chosen date. */}
          <CalendarPanel iso={valid ? iso : ""} min={min} max={max} onChoose={choose} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CalendarPanel({ iso, min, max, onChoose }: { iso: string; min?: string; max?: string; onChoose: (iso: string) => void }) {
  const [today] = useState(hijriToday);
  const floor = min ? hijriPartsFromIso(min) : null;
  const ceiling = max ? hijriPartsFromIso(max) : null;
  const firstYear = floor?.year ?? FIRST_YEAR;
  const lastYear = ceiling?.year ?? Math.max(LAST_YEAR, firstYear);

  // Opens at the chosen date; otherwise at today, or at the first allowed month when today is before it.
  const [view, setView] = useState<HijriMonth>(() => {
    // A stored date outside the allowed period opens at the nearest allowed month, to be corrected.
    const start = (iso ? hijriPartsFromIso(iso) : null) ?? today;
    if (floor && monthIndex(start) < monthIndex(floor)) return floor;
    if (ceiling && monthIndex(start) > monthIndex(ceiling)) return ceiling;
    return start;
  });
  const [focused, setFocused] = useState<string | null>(null);
  const moved = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // After the arrow keys move to another day, possibly in another month.
  useEffect(() => {
    if (!moved.current || !focused) return;
    moved.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused, view]);

  const { days, leading } = hijriMonthDays(view);
  const isDisabled = (dayIso: string) => Boolean((min && dayIso < min) || (max && dayIso > max));
  const inRange = (m: HijriMonth) =>
    m.year >= firstYear && m.year <= lastYear && (!floor || monthIndex(m) >= monthIndex(floor)) && (!ceiling || monthIndex(m) <= monthIndex(ceiling));

  const todayIso = hijriMonthDays(today).days.find((d) => d.day === today.day)?.iso ?? "";
  // One day takes the keyboard's Tab stop.
  const firstOpen = days.find((d) => !isDisabled(d.iso))?.iso;
  const tabStop = [focused, iso, todayIso].find((d) => d && days.some((x) => x.iso === d) && !isDisabled(d)) ?? firstOpen;

  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  // A stored date outside the range still shows.
  if (!years.includes(view.year)) years.push(view.year);
  years.sort((a, b) => a - b);

  function goTo(next: HijriMonth) {
    setFocused(null);
    if (floor && monthIndex(next) < monthIndex(floor)) setView({ year: floor.year, month: floor.month });
    else if (ceiling && monthIndex(next) > monthIndex(ceiling)) setView({ year: ceiling.year, month: ceiling.month });
    else setView(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, dayIso: string) {
    // Right to left: the left arrow moves forward.
    const step = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = isoPlusDays(dayIso, step);
    const parts = hijriPartsFromIso(next);
    if (!parts || isDisabled(next) || !inRange(parts)) return;
    moved.current = true;
    setFocused(next);
    setView({ year: parts.year, month: parts.month });
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="الشهر السابق" className={NAV_BUTTON} disabled={!inRange(shiftHijriMonth(view, -1))} onClick={() => goTo(shiftHijriMonth(view, -1))}>
          <ChevronRight aria-hidden="true" strokeWidth={1.75} />
        </button>
        {/* Stacked on a phone, so the longest month names show in full at the larger text sizes. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 min-[26rem]:flex-row">
        <Select
          aria-label="الشهر"
          className="w-full min-w-0 min-[26rem]:flex-1"
          value={view.month}
          onChange={(e) => goTo({ year: view.year, month: Number(e.target.value) })}
          options={HIJRI_MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label, disabled: !inRange({ year: view.year, month: i + 1 }) }))}
        />
        <Select
          aria-label="السنة"
          className="w-full shrink-0 min-[26rem]:w-[6.25rem]"
          value={view.year}
          onChange={(e) => goTo({ year: Number(e.target.value), month: view.month })}
          options={years.map((y) => ({ value: String(y), label: `${toArabicDigits(y)} هـ` }))}
        />
        </div>
        <button type="button" aria-label="الشهر التالي" className={NAV_BUTTON} disabled={!inRange(shiftHijriMonth(view, 1))} onClick={() => goTo(shiftHijriMonth(view, 1))}>
          <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
        </button>
      </div>

      <div aria-hidden="true" className="mt-3 grid grid-cols-7 gap-0.5 text-center text-[0.6875rem] font-semibold text-ink-subtle">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div ref={gridRef} role="group" aria-label={`${HIJRI_MONTH_NAMES[view.month - 1]} ${toArabicDigits(view.year)} هـ`} className="mt-1 grid grid-cols-7 gap-0.5">
        {leading > 0 ? <span aria-hidden="true" style={{ gridColumn: `span ${leading}` }} /> : null}
        {days.map((d) => {
          const selected = d.iso === iso;
          const isToday = d.iso === todayIso;
          return (
            <button
              key={d.iso}
              type="button"
              data-day={d.iso}
              tabIndex={d.iso === tabStop ? 0 : -1}
              disabled={isDisabled(d.iso)}
              aria-label={formatHijri(dateOf(d.iso))}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onChoose(d.iso)}
              onKeyDown={(event) => onKeyDown(event, d.iso)}
              className={cn(
                "t-figure flex h-10 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                selected ? "bg-primary font-bold text-primary-ink" : "text-ink hover:bg-primary-soft",
                isToday && !selected && "font-bold ring-1 ring-inset ring-accent",
                "disabled:cursor-not-allowed disabled:bg-transparent disabled:font-normal disabled:text-ink-subtle/50",
              )}
            >
              {toArabicDigits(d.day)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <button type="button" disabled={isDisabled(todayIso)} onClick={() => onChoose(todayIso)} className="rounded-sm px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent">
          اليوم
        </button>
        {iso ? (
          <button type="button" onClick={() => onChoose("")} className="rounded-sm px-2 py-1 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink">
            مسح التاريخ
          </button>
        ) : null}
      </div>
    </div>
  );
}
