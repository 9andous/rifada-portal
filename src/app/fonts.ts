import localFont from "next/font/local";

// Cairo for everything (DESIGN.md: Typography). Three faces are stacked in this order in --font-sans:
//  1. Rifada Cairo Tabular Digits: Arabic-Indic digits on one equal width, derived from Cairo by
//     scripts/fonts/build_tabular_digits.py (Cairo's own digits are proportional; see DECISIONS.md).
//  2. Cairo, Arabic subset (variable weight).
//  3. Cairo, Latin subset (variable weight).
// The browser falls through per glyph, so each character comes from the first face that has it.
// Automatic fallback metrics are disabled on the first two faces so a local fallback font can
// never take glyphs before Cairo does. The files live in public/fonts/cairo so PDF rendering
// (Playwright, Phase 6) loads the same files through the same pages.

export const cairoDigits = localFont({
  src: [
    { path: "../../public/fonts/cairo/cairo-tabular-digits-400.woff2", weight: "400" },
    { path: "../../public/fonts/cairo/cairo-tabular-digits-500.woff2", weight: "500" },
    { path: "../../public/fonts/cairo/cairo-tabular-digits-600.woff2", weight: "600" },
    { path: "../../public/fonts/cairo/cairo-tabular-digits-700.woff2", weight: "700" },
  ],
  variable: "--font-cairo-digits",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0660-066C, U+06F0-06F9" }],
});

export const cairoArabic = localFont({
  src: "../../public/fonts/cairo/cairo-arabic-wght-normal.woff2",
  weight: "200 1000",
  variable: "--font-cairo-arabic",
  display: "swap",
  adjustFontFallback: false,
});

export const cairoLatin = localFont({
  src: "../../public/fonts/cairo/cairo-latin-wght-normal.woff2",
  weight: "200 1000",
  variable: "--font-cairo-latin",
  display: "swap",
});

export const fontVariables = [cairoDigits.variable, cairoArabic.variable, cairoLatin.variable].join(" ");
