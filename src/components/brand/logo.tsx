import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

type LogoProps = {
  /** "auto" follows the theme; "onDark" always uses the white logo (for deep-green surfaces). */
  tone?: "auto" | "onDark";
  height?: number;
  className?: string;
  priority?: boolean;
};

/** The Rifada mark (ogee arch, gold diamonds). */
export function Logo({ tone = "auto", height = 48, className, priority }: LogoProps) {
  const { color, white, alt } = brand.logo;
  const width = Math.round((color.width / color.height) * height);

  if (tone === "onDark") {
    return <Image src={white.src} alt={alt} width={width} height={height} priority={priority} className={className} />;
  }

  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image src={color.src} alt={alt} width={width} height={height} priority={priority} className="dark:hidden" />
      <Image src={white.src} alt={alt} width={width} height={height} priority={priority} className="hidden dark:block" />
    </span>
  );
}

/**
 * The Presidency's mark. The file is a full-colour logo for light backgrounds, so in dark mode it
 * sits on a white plate rather than being recoloured; the plate's padding is the mark's clear
 * space, with a hairline so it reads as a deliberate tile.
 */
export function PresidencyLogo({ height = 54, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  const { src, width: w, height: h, alt } = brand.presidencyLogo;
  const width = Math.round((w / h) * height);
  return (
    <span className={cn("inline-flex shrink-0 dark:rounded-md dark:bg-white dark:p-2 dark:ring-1 dark:ring-line-strong", className)}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} />
    </span>
  );
}
