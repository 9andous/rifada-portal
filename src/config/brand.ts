// The only place the platform's identity and logo assets are referenced. The platform is known by
// the unit's name and carries the Presidency's logo (D-133).

export const brand = {
  unitName: "الوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين",
  /** The platform's name: header, page titles and emails. */
  unitShortName: "الوحدة الإشرافية على المنظمات غير الربحية",
  presidencyName: "رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  logo: {
    /** For light surfaces. */
    color: { src: "/brand/prh-logo.png", width: 236, height: 150 },
    /** For dark surfaces and dark mode. */
    white: { src: "/brand/prh-logo-white.png", width: 273, height: 184 },
    alt: "رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  },
  presidencyLogo: {
    src: "/brand/prh-logo.png",
    width: 236,
    height: 150,
    /** For dark surfaces (the footer). */
    white: { src: "/brand/prh-logo-white.png", width: 273, height: 184 },
    alt: "رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  },
  presidencyUrl: "https://www.prh.gov.sa",
} as const;
