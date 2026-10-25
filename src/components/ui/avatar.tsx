import { cn } from "@/lib/cn";

/** Initial circle (one of the few round shapes allowed by docs/DESIGN.md). */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-surface-sunken font-bold text-ink-muted",
        size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
        className,
      )}
    >
      {name.trim().charAt(0) || "—"}
    </span>
  );
}

/** A person with their initial circle. */
export function PersonName({ name, muted, className }: { name: string; muted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", muted && "text-ink-subtle", className)}>
      <Avatar name={name} size="sm" />
      {name}
    </span>
  );
}
