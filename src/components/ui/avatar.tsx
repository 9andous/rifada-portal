import { cn } from "@/lib/cn";

/** Initial tile: rounded square in soft green (design handoff `.who .av`). */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary-soft font-bold text-primary-soft-ink",
        size === "sm" ? "size-7 rounded-[7px] text-xs" : "size-9 rounded-[9px] text-sm",
        className,
      )}
    >
      {name.trim().charAt(0) || "—"}
    </span>
  );
}

/** A person with their initial tile. */
export function PersonName({ name, muted, className }: { name: string; muted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", muted && "text-ink-subtle", className)}>
      <Avatar name={name} size="sm" />
      {name}
    </span>
  );
}
