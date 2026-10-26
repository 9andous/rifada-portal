import { cn } from "@/lib/cn";

/** Ogee arch of the Rifada logo (viewBox 0 0 200 250): outer and inner outline. */
export const ARCH_PATH = "M4 250 V118 C4 72 50 52 100 6 C150 52 196 72 196 118 V250";
export const ARCH_INNER_PATH = "M30 250 V128 C30 92 66 78 100 40 C134 78 170 92 170 128 V250";

/** Decorative arch outline in the current colour; `inner` sets the inner outline's colour. */
export function ArchOutline({ className, inner = "currentColor", strokeWidth = 8 }: { className?: string; inner?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 250" fill="none" className={cn("pointer-events-none", className)}>
      <path d={ARCH_PATH} stroke="currentColor" strokeWidth={strokeWidth} />
      <path d={ARCH_INNER_PATH} stroke={inner} strokeWidth={strokeWidth / 2} />
    </svg>
  );
}

/** Small gold diamond used as an eyebrow and section marker. */
export function Diamond({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-[7px] shrink-0 rotate-45 bg-accent", className)} />;
}
