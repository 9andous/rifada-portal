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

export function Logo({ tone = "auto", height = 48, className, priority }: LogoProps) {
  const { color, white, alt } = brand.logo;
  const width = Math.round((color.width / color.height) * height);

  if (tone === "onDark") {
    return (
      <Image src={white.src} alt={alt} width={width} height={height} priority={priority} className={className} />
    );
  }

  return (
    <span className={cn("inline-flex", className)}>
      <Image src={color.src} alt={alt} width={width} height={height} priority={priority} className="dark:hidden" />
      <Image
        src={white.src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="hidden dark:block"
      />
    </span>
  );
}
