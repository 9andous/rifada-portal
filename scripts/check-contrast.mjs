// Verifies WCAG AA contrast for the semantic token pairs in src/styles/tokens.css, and for the
// design-lab directions when the (private) design lab is present. Add --verbose to list every pair.
// Usage: npm run contrast
import { existsSync, readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const labUrl = new URL("../src/app/dev/design-lab/lab.css", import.meta.url);
const labCss = existsSync(labUrl) ? readFileSync(labUrl, "utf8") : null;

function block(selector, source = css) {
  const start = source.indexOf(selector + " {");
  if (start < 0) throw new Error(`Selector not found: ${selector}`);
  const body = source.slice(start, source.indexOf("\n}", start));
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = block(":root");
const dark = { ...light, ...block('[data-theme="dark"]') };

function resolve(vars, name) {
  let v = vars[name];
  for (let i = 0; v && v.startsWith("var(") && i < 10; i++) v = vars[v.slice(6, -1)];
  return v;
}

function luminance(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [foreground, background, minimum ratio]: every text/background pair the app uses.
const SURFACES = ["canvas", "surface", "surface-muted", "surface-sunken"];
const STATUS = ["neutral", "info", "review", "warn", "ok", "bad"];
const CHARTS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"];
const pairs = [
  ...["ink", "ink-muted", "ink-subtle"].flatMap((fg) => SURFACES.map((bg) => [fg, bg, 4.5])),
  ...["primary", "accent-ink"].flatMap((fg) => ["canvas", "surface", "surface-muted"].map((bg) => [fg, bg, 4.5])),
  ["accent-ink", "accent-soft", 4.5],
  ["primary-ink", "primary", 4.5],
  ["primary-ink", "primary-hover", 4.5],
  ["primary-soft-ink", "primary-soft", 4.5],
  ...["on-band", "on-band-muted", "gold-on-band"].flatMap((fg) => ["band", "band-2"].map((bg) => [fg, bg, 4.5])),
  ...STATUS.map((t) => [`st-${t}`, `st-${t}-soft`, 4.5]),
  ...STATUS.flatMap((t) => ["surface", "canvas"].map((bg) => [`st-${t}`, bg, 4.5])),
  ["ink", "st-review-soft", 4.5],
  ["band", "gold-on-band", 4.5],
  ["ink-muted", "accent-soft", 4.5],
  ...["brand-ink"].flatMap((fg) => SURFACES.map((bg) => [fg, bg, 4.5])),
  ["on-gold-action", "gold-action", 4.5],
  ["on-gold-action", "gold-action-hover", 4.5],
  ...["band-ink", "band-ink-muted", "band-gold"].map((fg) => [fg, "band-deep", 4.5]),
  ["primary", "primary-soft", 4.5],
  // Non-text (WCAG 1.4.11): accents, focus rings, chart marks.
  ["accent", "surface", 3],
  ["accent", "canvas", 3],
  ["focus", "surface", 3],
  ["focus", "canvas", 3],
  ["gold-on-band", "band", 3],
  ...CHARTS.flatMap((c) => ["surface", "canvas"].map((bg) => [c, bg, 3])),
  ["line-strong", "surface", 1.3],
];

let failed = 0;
for (const [theme, vars] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg, min] of pairs) {
    const r = ratio(resolve(vars, fg), resolve(vars, bg));
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${theme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (min ${min})`);
  }
}
// Chart palette must stay distinguishable for common colour-vision deficiencies: simulate
// protanopia and deuteranopia (Machado et al. 2009, severity 1.0) and require a minimum CIE76
// difference between every pair of chart colours.
const CVD = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
};
const MIN_DELTA_E = 15;
function toLab(hex, m) {
  const n = hex.replace("#", "");
  const lin = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = [0, 1, 2].map((row) => Math.min(1, Math.max(0, m[row * 3] * lin[0] + m[row * 3 + 1] * lin[1] + m[row * 3 + 2] * lin[2])));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
for (const [theme, vars] of [["light", light], ["dark", dark]]) {
  for (const [kind, m] of Object.entries(CVD)) {
    let worst = { d: Infinity, pair: "" };
    for (let i = 0; i < CHARTS.length; i++) {
      for (let j = i + 1; j < CHARTS.length; j++) {
        const a = toLab(resolve(vars, CHARTS[i]), m);
        const b = toLab(resolve(vars, CHARTS[j]), m);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < worst.d) worst = { d, pair: `${CHARTS[i]}/${CHARTS[j]}` };
      }
    }
    const ok = worst.d >= MIN_DELTA_E;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${theme.padEnd(5)} chart palette, ${kind}: closest pair ${worst.pair} ΔE ${worst.d.toFixed(1)} (min ${MIN_DELTA_E})`);
  }
}

// Design lab: every text/background pair the three directions use, in both themes.
const surfaces = ["l-base", "l-s1", "l-s2", "l-s3"];
const labPairs = [
  ...["l-ink", "l-ink-2", "l-ink-3"].flatMap((fg) => surfaces.map((bg) => [fg, bg, 4.5])),
  ...["l-primary", "l-gold-ink"].flatMap((fg) => ["l-base", "l-s1", "l-s2"].map((bg) => [fg, bg, 4.5])),
  ["l-on-primary", "l-primary", 4.5],
  ["l-on-primary", "l-primary-hover", 4.5],
  ...["l-on-brand", "l-on-brand-2", "l-gold-on-brand"].flatMap((fg) => ["l-brand", "l-brand-2"].map((bg) => [fg, bg, 4.5])),
  ...["neutral", "info", "review", "warn", "ok", "bad"].map((t) => [`l-st-${t}-fg`, `l-st-${t}-bg`, 4.5]),
  ...["neutral", "info", "review", "warn", "ok", "bad"].map((t) => [`l-st-${t}-fg`, "l-s1", 4.5]),
  ["l-gold", "l-base", 3],
  ["l-gold", "l-s1", 3],
  ["l-focus", "l-base", 3],
  ["l-focus", "l-s1", 3],
  ["l-line-2", "l-s1", 1.3],
  ["l-chart", "l-base", 3],
  ["l-chart", "l-s1", 3],
  ["l-chart", "l-s3", 3],
  // Gold buttons on the brand zone (C) and conversation bubbles (C).
  ["l-brand", "l-gold-on-brand", 4.5],
  ["l-ink", "l-st-review-bg", 4.5],
  ["l-ink-2", "l-st-review-bg", 4.5],
  ["l-ink-3", "l-st-review-bg", 4.5],
  ["l-gold-ink", "l-s2", 4.5],
];
for (const dir of labCss ? ["a", "b", "c"] : []) {
  const light = block(`.lab-${dir}`, labCss);
  const dark = { ...light, ...block(`[data-theme="dark"] .lab-${dir}`, labCss) };
  for (const [theme, vars] of [["light", light], ["dark", dark]]) {
    for (const [fg, bg, min] of labPairs) {
      const r = ratio(resolve(vars, fg), resolve(vars, bg));
      const ok = r >= min;
      if (!ok) failed++;
      if (!ok || process.argv.includes("--verbose")) {
        console.log(`${ok ? "ok  " : "FAIL"} lab-${dir} ${theme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (min ${min})`);
      }
    }
  }
  console.log(`lab-${dir}: ${labPairs.length * 2} pairs checked`);
}

if (failed) {
  console.error(`\n${failed} pair(s) below the required contrast.`);
  process.exit(1);
}
