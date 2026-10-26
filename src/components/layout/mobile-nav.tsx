"use client";

import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { activeNavHref, UNAVAILABLE_HINT, type NavItem } from "@/config/nav";
import { cn } from "@/lib/cn";
import { NavIcon } from "./nav-icon";

/** Navigation drawer for widths where the band cannot fit every item (tablet and below). */
export function MobileNav({ items, root, roleLabel }: { items: NavItem[]; root: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the drawer after navigation
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex size-[42px] items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink lg:hidden [&_svg]:size-5"
        aria-label="فتح القائمة"
      >
        <Menu aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="band-scope fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-band text-band-ink shadow-3 focus:outline-none">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">{roleLabel}</Dialog.Title>
            <Dialog.Close
              className="inline-flex size-8 items-center justify-center rounded-sm hover:bg-white/10 [&_svg]:size-4"
              aria-label="إغلاق القائمة"
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">روابط التنقل الرئيسية</Dialog.Description>
          <ul className="flex flex-col p-3">
            {items.map((item) => {
              const active = Boolean(item.href) && item.href === activeNavHref(items, root, pathname);
              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-e-md border-s-4 px-4 py-3.5 text-base font-semibold [&_svg]:size-[18px]",
                        active ? "border-band-gold bg-white/10 font-bold" : "border-transparent text-band-ink/85 hover:bg-white/[0.06] hover:text-band-ink",
                      )}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-disabled="true" title={UNAVAILABLE_HINT} className="flex cursor-not-allowed items-center gap-3 border-s-4 border-transparent px-4 py-3.5 text-base font-semibold text-band-ink/60 [&_svg]:size-[18px]">
                      <NavIcon name={item.icon} />
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
