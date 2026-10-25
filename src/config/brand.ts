// The only place logo assets are referenced. This repository ships a neutral placeholder mark;
// the official logos are private material (docs/ONBOARDING.md). To use them locally, put the files
// in public/brand/ (never commit them; they are in .gitignore) and update the paths, intrinsic sizes
// and alt text here.

export const brand = {
  unitName: "الوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين",
  presidencyName: "رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  productName: "رفادة",
  logo: {
    /** For light surfaces. */
    color: { src: "/brand/placeholder-logo-color.png", width: 236, height: 150 },
    /** For dark surfaces and dark mode. */
    white: { src: "/brand/placeholder-logo-white.png", width: 944, height: 600 },
    alt: "رفادة",
  },
} as const;
