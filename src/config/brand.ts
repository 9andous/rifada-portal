// The only place logo assets are referenced. Replace with the official vector files when the
// Presidency provides them, keeping the intrinsic sizes in step.

export const brand = {
  unitName: "الوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين",
  presidencyName: "رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  productName: "رفادة",
  systemName: "منصة رفادة",
  logo: {
    /** For light surfaces. */
    color: { src: "/brand/rifada-logo-color.png", width: 249, height: 288 },
    /** For dark surfaces and dark mode. */
    white: { src: "/brand/rifada-logo-white.png", width: 249, height: 288 },
    alt: "رفادة",
  },
  presidencyLogo: {
    src: "/brand/prh-logo.png",
    width: 236,
    height: 150,
    alt: "رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  },
  presidencyUrl: "https://www.prh.gov.sa",
} as const;
