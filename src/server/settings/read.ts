import "server-only";
import { db } from "@/server/db";
import { SETTING_DEFAULTS, type SettingKey } from "./defaults";

type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K] extends number
  ? number
  : (typeof SETTING_DEFAULTS)[K] extends boolean
    ? boolean
    : (typeof SETTING_DEFAULTS)[K];

/** Reads a setting from the database, falling back to its default when unset or malformed. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.setting.findUnique({ where: { key } });
  const fallback = SETTING_DEFAULTS[key];
  if (!row || typeof row.value !== typeof fallback) return fallback as SettingValue<K>;
  return row.value as SettingValue<K>;
}
