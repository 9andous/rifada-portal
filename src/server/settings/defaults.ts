// Admin-configurable settings and their defaults. Stored in the `settings` table as JSON.

export const HERO_QUOTE_STYLES = ["cream", "card"] as const;
export type HeroQuoteStyle = (typeof HERO_QUOTE_STYLES)[number];

export const SETTING_DEFAULTS = {
  /** Review target, in working days (Sunday to Thursday). */
  "sla.workingDays": 3,
  /** Maximum size per uploaded file, in megabytes. */
  "uploads.maxFileMb": 25,
  /** Allowed upload groups. Video is never allowed. */
  "uploads.allowedGroups": ["pdf", "word", "excel", "image"],
  /** Storage quota per association for request files, in megabytes (placeholder value, D-075). */
  "uploads.associationQuotaMb": 2048,
  /** Maximum number of requests in one bulk review action. */
  "bulk.maxItems": 25,
  /** When false, initiative lists are shown only to signed-in users. */
  "public.showInitiatives": false,
  /** Look of the leadership statements in the home hero: a cream card or a translucent card (D-096). */
  "public.heroQuoteStyle": "cream" as HeroQuoteStyle,
  /** Set by the demo-mode loader; true while demo records exist. */
  "demo.enabled": false,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
