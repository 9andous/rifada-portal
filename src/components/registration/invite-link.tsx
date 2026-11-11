"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { StatusText } from "@/components/ui/surface";
import { inviteOpen, registrationLinkPath } from "@/lib/registrations";

/**
 * An association's registration link with a copy button and its validity (D-149). The link is
 * built on this site's own address, so it is right on every deployment.
 */
export function InviteLink({ token, expiresAt, used = false }: { token: string; expiresAt: string | null; used?: boolean }) {
  const path = registrationLinkPath(token);
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  // The address is known only in the browser; the server render shows the path.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the origin exists only on the client
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);

  const open = !used && inviteOpen(expiresAt);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="t-label">رابط التسجيل</span>
        {used ? (
          <StatusText tone="neutral">استُعمل</StatusText>
        ) : open ? (
          <StatusText tone="ok">صالح</StatusText>
        ) : (
          <StatusText tone="bad">منتهي الصلاحية</StatusText>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <bdi dir="ltr" data-testid="invite-link" className={`block select-all break-all rounded-md border border-line-strong bg-surface-muted px-3 py-2 font-mono text-sm ${open ? "text-ink" : "text-ink-subtle line-through"}`}>
          {url}
        </bdi>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-muted">
            {used ? "تعطل بعد إرسال الجمعية بياناتها." : open ? "صالح حتى" : "انتهت صلاحيته في"}
            {used ? null : <DateDisplay date={expiresAt ? new Date(expiresAt) : null} className="font-semibold text-ink" />}
          </span>
          {open ? (
            <Button variant="outline" size="sm" onClick={copy}>
              {copied === "done" ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Copy aria-hidden="true" strokeWidth={1.75} />}
              {copied === "done" ? "نُسخ الرابط" : "نسخ الرابط"}
            </Button>
          ) : null}
        </div>
        {copied === "failed" ? <p className="text-xs text-danger">تعذّر النسخ؛ حدّد الرابط وانسخه يدويًا.</p> : null}
      </div>
    </div>
  );
}
