"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { markNotificationReadAction } from "@/server/actions/notifications";

import type { BellItem } from "@/server/services/notifications";

type BellState = { items: BellItem[]; unread: number };
type Permission = NotificationPermission | "unsupported";

// The browser's notification permission, re-read after the user answers the prompt.
const permissionListeners = new Set<() => void>();
const readPermission = (): Permission => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
const subscribePermission = (l: () => void) => {
  permissionListeners.add(l);
  return () => permissionListeners.delete(l);
};

/** Shows an operating-system notification while the tab is in the background, when allowed. */
function systemNotify(item: BellItem) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const n = new Notification(item.title, { body: item.body ?? undefined, icon: "/brand/rifada-logo-color.png", tag: item.id, lang: "ar", dir: "rtl" });
    n.onclick = () => {
      window.focus();
      if (item.link) window.location.assign(item.link);
      n.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; the toast still shows.
  }
}

/**
 * The notification bell in the header (design handoff, D-108): the unread count on the bell, the
 * latest notifications in a panel; opening one marks it read, and «تعليم الكل كمقروء» clears them.
 * Live (D-111): one EventSource per tab keeps it current; a new notification shows a toast, and a
 * system notification when the tab is in the background and the user allowed them.
 */
export function NotificationBell({ items: initialItems, unread: initialUnread }: BellState) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [{ items, unread }, setBell] = useState<BellState>({ items: initialItems, unread: initialUnread });
  const permission = useSyncExternalStore(subscribePermission, readPermission, () => "unsupported" as Permission);
  const seen = useRef(new Set(initialItems.map((n) => n.id)));

  useEffect(() => {
    // One stream for the life of the header; the browser reconnects on its own after a drop.
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("update", (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as BellState & { fresh: boolean };
      setBell({ items: next.items, unread: next.unread });
      const arrived = next.items.filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of next.items) seen.current.add(n.id);
      if (!next.fresh) return;
      const latest = arrived[0];
      if (latest) {
        toast(latest.title, { description: latest.body ?? undefined, tone: "info" });
        systemNotify(latest);
      }
    });
    return () => source.close();
  }, []);

  function markRead(id?: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      // The stream brings the new count; refresh only pages that show notices tied to it.
      router.refresh();
    });
  }

  function allowSystem() {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then((p) => {
      for (const l of permissionListeners) l();
      if (p === "granted") toast("فُعّلت تنبيهات النظام", { description: "ستصلكم الإشعارات الجديدة ولو كانت الصفحة في الخلفية." });
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="relative inline-flex size-[42px] items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink data-[state=open]:bg-surface-sunken data-[state=open]:text-ink [&_svg]:size-5"
        aria-label={unread ? `الإشعارات، ${formatNumber(unread)} غير مقروءة` : "الإشعارات"}
        title="الإشعارات"
      >
        <Bell aria-hidden="true" strokeWidth={1.75} />
        {unread ? (
          <span aria-hidden="true" className="t-figure absolute end-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-st-bad px-1 text-[0.6875rem] font-bold leading-none text-white ring-2 ring-surface">
            {unread > 9 ? "+٩" : formatNumber(unread)}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content dir="rtl" align="center" sideOffset={8} collisionPadding={16} className="z-50 w-[340px] rounded-xl border border-line bg-surface p-1.5 text-ink shadow-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <p className="text-[0.9375rem] font-bold">الإشعارات</p>
            {unread ? (
              <button type="button" onClick={() => markRead()} disabled={pending} className="ms-auto rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-60">
                تعليم الكل كمقروء
              </button>
            ) : null}
          </div>
          {permission === "default" ? (
            <button type="button" onClick={allowSystem} className="mx-1.5 mb-1.5 w-[calc(100%-0.75rem)] rounded-md border border-line bg-surface-muted px-3 py-2 text-start text-sm font-semibold text-ink hover:bg-surface-sunken">
              تفعيل تنبيهات النظام على هذا الجهاز
            </button>
          ) : null}
          {items.length ? (
            <ul className="max-h-[360px] overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <>
                    <span aria-hidden="true" className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-st-bad")} />
                    <span className="min-w-0">
                      <span className={cn("block text-sm leading-snug", n.read ? "text-ink-muted" : "font-semibold text-ink")}>{n.title}</span>
                      {n.body ? <span className="mt-0.5 block truncate text-xs text-ink-subtle">{n.body}</span> : null}
                      <span className="mt-0.5 block text-xs text-ink-subtle">{n.when}</span>
                    </span>
                  </>
                );
                const row = "flex w-full gap-2.5 rounded-md px-3 py-2.5 text-start hover:bg-surface-sunken";
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        className={row}
                        onClick={() => {
                          setOpen(false);
                          if (!n.read) markRead(n.id);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className={row}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 pb-4 pt-2 text-sm text-ink-muted">لا توجد إشعارات بعد.</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
