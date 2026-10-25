import { toArabicDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Request reference (RF-1448-00142) inside right-to-left text. Arabic-Indic digit groups separated
 * by hyphens are reordered by the bidi algorithm even in an LTR span, so each hyphen is pinned with
 * left-to-right marks (DECISIONS.md D-018).
 */
export function RefNumber({ value, className }: { value: string; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("whitespace-nowrap tabular-nums", className)}>
      {toArabicDigits(value).replace(/-/g, "\u200E-\u200E")}
    </bdi>
  );
}
