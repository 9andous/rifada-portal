"use client";

import { CalendarDays, ChevronDown, Globe, Lock } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { formatHijri } from "@/lib/format";
import { cn } from "@/lib/cn";

const noSubscribe = () => () => {};

/** Today's Hijri date, rendered only on the client so server and client markup always agree. */
function useToday(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => formatHijri(new Date()),
    () => null,
  );
}

/** Saudi government banner above the header, with the «كيف تتحقق» explanation panel. */
export function GovBar() {
  const [open, setOpen] = useState(false);
  const today = useToday();

  return (
    <div data-print="hide">
      <div className="border-b border-line bg-surface-sunken text-xs text-ink-muted">
        <div className="mx-auto flex h-[38px] max-w-[1360px] items-center gap-2.5 px-4 sm:px-8">
          <svg aria-hidden="true" width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
            <rect width="20" height="14" rx="2" fill="#006c35" />
            <rect x="5" y="8.6" width="10" height="1" rx=".5" fill="#fff" />
            <path d="M6 5.5h8" stroke="#fff" strokeWidth=".9" strokeLinecap="round" />
          </svg>
          <span className="truncate">موقع حكومي رسمي تابع لحكومة المملكة العربية السعودية</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="gov-verify"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-primary"
          >
            كيف تتحقق
            <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {today ? (
            <span className="ms-auto hidden items-center gap-1.5 md:inline-flex">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {today}
            </span>
          ) : null}
        </div>
      </div>
      {open ? (
        <div id="gov-verify" className="fade-up border-b border-line bg-surface">
          <div className="mx-auto grid max-w-[1360px] gap-6 px-4 py-[18px] sm:px-8 md:grid-cols-2 md:gap-8">
            <VerifyItem icon={<Globe aria-hidden="true" />} title={<>روابط المواقع الرسمية السعودية تنتهي بـ <span dir="ltr">gov.sa</span></>}>
              جميع روابط المواقع الرسمية للجهات الحكومية في المملكة تنتهي بالنطاق <span dir="ltr">gov.sa</span>.
            </VerifyItem>
            <VerifyItem icon={<Lock aria-hidden="true" />} title={<>المواقع الحكومية تستخدم بروتوكول <span dir="ltr">HTTPS</span></>}>
              المواقع الآمنة في المملكة العربية السعودية تستخدم بروتوكول <span dir="ltr">HTTPS</span> للتشفير.
            </VerifyItem>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VerifyItem({ icon, title, children }: { icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-[18px]">{icon}</span>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
