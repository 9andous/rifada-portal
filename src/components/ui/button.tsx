import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "gold" | "dark" | "onBand" | "outlineOnBand" | "warning";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover",
  secondary: "bg-primary-soft text-primary-soft-ink hover:bg-surface-sunken",
  outline: "border border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
  ghost: "text-primary hover:bg-primary-soft",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
  warning: "border border-warning/45 bg-surface text-warning hover:bg-warning-soft",
  gold: "bg-gold-action text-on-gold-action hover:bg-gold-action-hover",
  dark: "bg-band text-band-ink hover:bg-band-2",
  /** Page-head and green-surface actions: the gold button of the design. */
  onBand: "bg-gold-action text-on-gold-action hover:bg-gold-action-hover",
  /** Secondary action on green surfaces. */
  outlineOnBand: "border border-white/25 text-band-ink hover:border-band-gold hover:bg-white/[0.06]",
};

const sizes: Record<Size, string> = {
  sm: "h-[34px] gap-1.5 rounded-sm px-3 text-[0.8125rem]",
  md: "h-[42px] gap-2 rounded-md px-[18px] text-sm",
  lg: "h-[50px] gap-2 rounded-md px-6 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Render the child element (e.g. a Link) with button styles. */
  asChild?: boolean;
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ variant = "primary", size = "md", asChild, className, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
