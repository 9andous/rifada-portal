"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationReadAction } from "@/server/actions/notifications";

/** The ✕ on a home-page notice: marks its notification read, so the notice does not come back. */
export function DismissNotice({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationReadAction(notificationId);
          router.refresh();
        })
      }
      aria-label="إخفاء الإشعار"
      title="إخفاء الإشعار"
      className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-current bg-surface text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50 [&_svg]:size-5"
    >
      <X aria-hidden="true" strokeWidth={2.5} />
    </button>
  );
}
