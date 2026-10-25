"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

export function SignOutButton({ variant = "surface" }: { variant?: "band" | "surface" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.replace("/login");
          router.refresh();
        })
      }
      title="تسجيل الخروج"
      className={cn(
        "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors disabled:opacity-60 [&_svg]:size-4",
        variant === "band"
          ? "text-on-band-muted hover:bg-white/10 hover:text-on-band focus-visible:outline-gold-on-band"
          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
      )}
    >
      <LogOut aria-hidden="true" />
      <span className={variant === "band" ? "sr-only xl:not-sr-only" : undefined}>
        {pending ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
      </span>
    </button>
  );
}
