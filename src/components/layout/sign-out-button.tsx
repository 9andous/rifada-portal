"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/** Signs out and returns to the login page; shared by the button and the user menu. */
export function useSignOut() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    });
  return { pending, signOut };
}

/** `labelled`: the words always show (the phone menu); otherwise they show from xl. */
export function SignOutButton({ variant = "surface", labelled }: { variant?: "band" | "surface"; labelled?: boolean }) {
  const { pending, signOut } = useSignOut();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={signOut}
      title="تسجيل الخروج"
      className={cn(
        "inline-flex h-[42px] items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-60 [&_svg]:size-[18px]",
        variant === "band"
          ? "text-band-ink-muted hover:bg-white/10 hover:text-band-ink focus-visible:outline-band-gold"
          : "text-st-bad hover:bg-st-bad-soft",
      )}
    >
      <LogOut aria-hidden="true" />
      <span className={labelled ? undefined : "sr-only xl:not-sr-only"}>
        {pending ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
      </span>
    </button>
  );
}
