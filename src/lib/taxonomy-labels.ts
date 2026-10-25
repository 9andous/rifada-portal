// Arabic labels for the taxonomy editors' states (D-050). Programs take the masculine form,
// initiatives and attachment types the feminine/neutral form.

import type { StatusTone } from "@/components/ui/surface";

export type EntityState = "active" | "paused" | "archived";

export const STATE_TONE: Record<EntityState, StatusTone> = { active: "ok", paused: "warn", archived: "neutral" };

export const PROGRAM_STATE_LABEL: Record<EntityState, string> = { active: "نشط", paused: "موقوف", archived: "مؤرشف" };
export const INITIATIVE_STATE_LABEL: Record<EntityState, string> = { active: "نشطة", paused: "موقوفة", archived: "مؤرشفة" };

export const STATE_FILTER_OPTIONS = {
  program: [
    { value: "active", label: "نشط" },
    { value: "paused", label: "موقوف" },
    { value: "archived", label: "مؤرشف" },
  ],
  initiative: [
    { value: "active", label: "نشطة" },
    { value: "paused", label: "موقوفة" },
    { value: "archived", label: "مؤرشفة" },
  ],
};
