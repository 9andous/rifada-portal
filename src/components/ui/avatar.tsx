import { initials } from "@/lib/images";
import { cn } from "@/lib/cn";

/**
 * A person's or association's tile: their picture when there is one, otherwise the first two
 * letters of the name on soft green (design handoff `.who .av`).
 */
export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-primary-soft font-bold text-primary-soft-ink",
        size === "sm" ? "size-7 rounded-[7px] text-[0.6875rem]" : "size-9 rounded-[9px] text-xs",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private, signed-in-only image
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** A person with their tile. */
export function PersonName({ name, src, muted, className }: { name: string; src?: string | null; muted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", muted && "text-ink-subtle", className)}>
      <Avatar name={name} src={src} size="sm" />
      {name}
    </span>
  );
}
