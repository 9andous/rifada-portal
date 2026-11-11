// Where associations may serve (D-149): the Presidency's supervision covers religious services inside
// the Grand Mosque in Makkah and the Prophet's Mosque in Madinah only («أماكن تقديم الخدمة»). The
// association chooses its site, then the places inside it. Keys are stored; labels are shown.

export const SERVICE_SITES = {
  MAKKAH: {
    city: "مكة المكرمة",
    region: "منطقة مكة المكرمة",
    mosque: "المسجد الحرام",
    places: [
      { key: "mataf", label: "صحن المطاف" },
      { key: "masaa", label: "المسعى" },
      { key: "arcades", label: "الأروقة والأدوار والتوسعات" },
      { key: "courtyards", label: "الساحات المحيطة بالمسجد الحرام" },
      { key: "women", label: "مصليات النساء" },
      { key: "lessons", label: "مواقع الدروس والحلقات العلمية" },
      { key: "libraries", label: "المكتبات داخل المسجد الحرام" },
    ],
  },
  MADINAH: {
    city: "المدينة المنورة",
    region: "منطقة المدينة المنورة",
    mosque: "المسجد النبوي",
    places: [
      { key: "rawdah", label: "الروضة الشريفة" },
      { key: "arcades", label: "الأروقة والأدوار والتوسعات" },
      { key: "courtyards", label: "الساحات المحيطة بالمسجد النبوي" },
      { key: "women", label: "مصليات النساء" },
      { key: "lessons", label: "مواقع الدروس والحلقات العلمية" },
      { key: "libraries", label: "المكتبات داخل المسجد النبوي" },
    ],
  },
} as const;

export type ServiceSite = keyof typeof SERVICE_SITES;
export const SERVICE_SITE_KEYS = Object.keys(SERVICE_SITES) as ServiceSite[];

export function isServiceSite(value: string | null | undefined): value is ServiceSite {
  return value === "MAKKAH" || value === "MADINAH";
}

/** The place keys of a site. */
export function placeKeysOf(site: ServiceSite): string[] {
  return SERVICE_SITES[site].places.map((p) => p.key);
}

/** Labels of stored place keys, in the site's order; unknown keys are left out. */
export function placeLabels(site: string | null | undefined, keys: readonly string[]): string[] {
  if (!isServiceSite(site)) return [];
  return SERVICE_SITES[site].places.filter((p) => keys.includes(p.key)).map((p) => p.label);
}

/** «المسجد الحرام — مكة المكرمة», or null. */
export function siteLabel(site: string | null | undefined): string | null {
  if (!isServiceSite(site)) return null;
  return `${SERVICE_SITES[site].mosque} — ${SERVICE_SITES[site].city}`;
}
