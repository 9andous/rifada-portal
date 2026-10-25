import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Khatam lattice from direction C: an eight-point star per tile drawn as one outline, an inner
 * circle, small diamonds where four tiles meet and short connecting strokes. Thin and faint.
 * Used only on green bands, the login panel and (Phase 5) the home hero; never behind body text.
 *
 * `offsetY` shifts the tile origin so two stacked bands (navigation, then the page band) read as
 * one continuous pattern.
 */
export function GeometricPattern({
  className,
  size = 104,
  offsetY = 0,
  tone = "band",
}: {
  className?: string;
  size?: number;
  offsetY?: number;
  /** "band" for green bands; "canvas" for the rare use on ivory surfaces. */
  tone?: "band" | "canvas";
}) {
  const id = useId();
  const c = size / 2;
  const outer = size * 0.42;
  // Inner radius of a regular {8/2} star polygon.
  const inner = (outer * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8);
  const star = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  const d = size * 0.08;
  const diamond = (x: number, y: number) => `M${x} ${y - d} L${x + d} ${y} L${x} ${y + d} L${x - d} ${y} Z`;

  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={id} width={size} height={size} y={-offsetY} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={tone === "band" ? "var(--pattern-on-band)" : "var(--pattern-stroke)"} strokeWidth="0.9">
            <polygon points={star} />
            <circle cx={c} cy={c} r={inner * 0.55} />
            <path d={[diamond(0, 0), diamond(size, 0), diamond(0, size), diamond(size, size)].join(" ")} />
            <path d={`M${c} 0 V${c - outer} M${c} ${size} V${c + outer} M0 ${c} H${c - outer} M${size} ${c} H${c + outer}`} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
