"use client";

import { ChevronDown, CircleHelp, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useSignOut } from "./sign-out-button";

const ITEM =
  "flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-[0.9375rem] font-medium outline-none select-none [&_svg]:size-[18px] data-[highlighted]:bg-surface-sunken";

/**
 * The user chip in the header opens a menu with «المساعدة» (when the role has a help page) and
 * «تسجيل الخروج» (owner's request, 2026-10-28). `chip` is the server-rendered avatar and name.
 */
export function UserMenu({ chip, helpHref, verifyHref }: { chip: ReactNode; helpHref?: string; verifyHref?: string }) {
  const { pending, signOut } = useSignOut();

  return (
    <DropdownMenu.Root dir="rtl" modal={false}>
      <DropdownMenu.Trigger
        className="group flex items-center gap-1 rounded-xl text-start outline-offset-2 transition-shadow hover:shadow-2 data-[state=open]:shadow-2"
        aria-label="قائمة المستخدم"
      >
        {chip}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-3"
        >
          {verifyHref ? (
            <>
              <DropdownMenu.Item asChild className={ITEM}>
                <Link href={verifyHref}>
                  <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="text-ink-muted" />
                  التحقق من وثيقة
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="mx-1.5 my-1.5 h-px bg-line" />
            </>
          ) : null}
          {helpHref ? (
            <>
              <DropdownMenu.Item asChild className={ITEM}>
                <Link href={helpHref}>
                  <CircleHelp aria-hidden="true" strokeWidth={1.75} className="text-ink-muted" />
                  المساعدة
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="mx-1.5 my-1.5 h-px bg-line" />
            </>
          ) : null}
          <DropdownMenu.Item
            disabled={pending}
            onSelect={(e) => {
              e.preventDefault();
              signOut();
            }}
            className={cn(ITEM, "text-st-bad data-[highlighted]:bg-st-bad-soft data-[disabled]:opacity-60")}
          >
            <LogOut aria-hidden="true" strokeWidth={1.75} />
            {pending ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The arrow inside the chip that shows it opens a menu. */
export function UserMenuArrow() {
  return <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-subtle transition-transform group-data-[state=open]:rotate-180" />;
}
