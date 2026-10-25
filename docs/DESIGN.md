# Design system

The approved visual design for Rifada: direction C (Heritage panel) as the base, with specific
elements of direction A (Editorial masthead). Every screen, including those built in later phases,
follows this document. The three original directions were compared in a development-only design
lab, which is not part of the public repository (private material, see docs/ONBOARDING.md).

Decisions here are settled; change them only with the owner's approval. Technical background is in
`docs/DECISIONS.md` (D-020 onward).

## Principles

- Calm, authoritative, premium government product; clearly different from the colleague's draft.
- Dense where data lives, generous on public pages.
- No emoji, no dashed borders, no pills, no glassmorphism, no translucent floating cards, no
  gradient blobs, no decorative stock imagery, no grids of identical bordered tiles.
- One line-icon set: Lucide, stroke 1.75, sizes `size-4` inline, `size-[18px]` in navigation,
  `size-5` in state icons.
- Right-to-left with logical properties only (`ms-/me-/ps-/pe-`, `start/end`, `border-s/e`).
  `npm run lint` rejects physical-direction utilities and emoji.

## Typography

- **Font:** Cairo for everything (headings, body, tables, numbers, buttons). Self-hosted with
  `next/font/local` in `src/app/fonts.ts`; the files live in `public/fonts/cairo/` so the PDF
  renderer (Phase 6, Playwright) loads the same files through the same pages.
- **Digits:** Arabic-Indic (٠١٢٣٤٥٦٧٨٩) everywhere, through `formatNumber` / `toArabicDigits` /
  `<RefNumber>`. Cairo's own Arabic-Indic digits are proportional and the font has no `tnum`
  feature, so a derived digits-only face, "Rifada Cairo Tabular Digits"
  (`scripts/fonts/build_tabular_digits.py`), puts every digit on one equal, deliberately tight width
  (the widest digits ٣ ٥ ٧ ٨ are slightly condensed so ١ and ٠ do not float apart) and is stacked
  before Cairo (approved by the owner). Cairo draws ٠ as a small square that reads as an empty
  glyph at figure sizes; the derived face replaces it with a filled round dot, the conventional
  Arabic zero. The specimen page belonged to the design lab (private).
- **Roles** (defined once in `src/app/globals.css`, components layer):

  | Class | Use | Size / weight |
  |---|---|---|
  | `t-page` | Page title (on the band) | 2rem / 700 |
  | `t-section` | Section and card titles | 1.0625rem / 700 |
  | `t-label` | Field labels, column headers, figure labels | 0.8125rem / 600, `ink-subtle` |
  | `t-body` | Running text | 0.9375rem / 400, line-height 1.85, `ink-muted` |
  | `t-figure` | Key figures and counts | size per context / 700, tabular |
  | `t-table` | Table text | 0.875rem, tabular |
  | `t-caption` | Notes, timestamps, helper text | 0.75rem, `ink-subtle` |

- **Page titles** get a short gold rule underneath (2px x 48px), from direction A.
- **Section headings** start with a small gold diamond (from C). No divider lines under headings.

## Shape and elevation

- **Corners are sharp: 2px** on cards, inputs, buttons, tags, menus and modals. Every Tailwind
  radius step is set to 2px in `globals.css`. Only avatars (initial circles), status dots and
  radio buttons are round (`rounded-full`).
- Elevation is led by hairline borders; shadows are faint (`shadow-1` cards, `shadow-2`/`shadow-3`
  menus and modals).

## Colour

Tokens live in `src/styles/tokens.css`; Tailwind utilities are mapped in `globals.css`. Values come
from direction C of the (private) design lab. `npm run contrast` checks every text/background pair in both
themes (WCAG AA 4.5:1 for text, 3:1 for accents, focus rings and chart marks) and the chart
palette's distinguishability under simulated protanopia and deuteranopia.

| Token | Role | Light | Dark |
|---|---|---|---|
| `canvas` | Level 0, page | `#f5efe1` | `#101714` |
| `surface` | Level 1, cards | `#fffcf4` | `#16201c` |
| `surface-muted` | Level 2, raised: table headers, inputs, hover | `#f6f0e2` | `#1c2723` |
| `surface-sunken` | Level 3, highest: selected rows, tracks | `#eee5d1` | `#23302b` |
| `line` | Hairline | `#e8dec8` | `#283530` |
| `line-strong` | Input border, stronger rule | `#d3c6a9` | `#374741` |
| `ink` / `ink-muted` / `ink-subtle` | Text levels | `#221f1a` / `#524c43` / `#6b645a` | `#efe9dc` / `#bcc1b8` / `#979f97` |
| `band` / `band-2` | Green band | `#1d4236` / `#255043` | `#122a22` / `#1a382d` |
| `on-band` / `on-band-muted` | Text on the band | `#ffffff` / `#c4d6cd` | `#f4efe2` / `#adc1b7` |
| `gold-on-band` | Gold on the band (active marks, key figures, rules) | `#dcc27c` | `#dcc27c` |
| `primary` | Primary action | `#1d4236` (green) | `#d2b56a` (gold) |
| `accent` | Gold accent: rules, diamonds, marks (non-text) | `#9c7b26` | `#c8a95a` |
| `accent-ink` | Gold text on surfaces | `#775c1a` | `#d6ba6e` |

- **Primary button** is green in light mode and gold in dark mode.
- **Gold** is an accent (rules, active marks, key figures). It is never body text on light
  surfaces except through `accent-ink`.
- **Status colours** are fixed and separate from the chart palette: `st-neutral`, `st-info`,
  `st-review`, `st-warn`, `st-ok`, `st-bad`, each with a `-soft` background.
- **Chart palette** (six brand-derived colours, colour-blind checked): green `chart-1`, gold
  `chart-2`, teal `chart-3`, slate blue `chart-4`, terracotta `chart-5`, sand `chart-6`, on the
  `chart-track` background.
- **Dark mode** is designed, not inverted: a deep green-black base with three slightly lighter,
  greener levels, hairline borders, soft status colours, gold actions. No pure black. No tinted
  amber or brown banners: notices are plain surfaces with a coloured side rule (`<Alert>`).

## Geometric pattern

- The khatam lattice from direction C (`<GeometricPattern>`): eight-point star, inner circle,
  corner diamonds, faint gold stroke (about 10 to 12% opacity).
- Used on the green bands inside the app, on the login panel and (Phase 5) on the public home hero.
- Never behind body text on ivory surfaces, never in empty states.

## App shell

- **Top navigation** inside the green band (no sidebar). Logo (white) at the start, navigation
  items, then theme toggle, user name with role or association, an initial-circle avatar, and sign
  out. Active item: white bold text with a 3px gold underline (from A).
- **Items per role** (short lists; items whose screens arrive in later phases are shown as
  unavailable, not clickable, and become links when their phase ships):
  - Unit manager: الرئيسية، الطلبات، الإسناد، الجمعيات، البرامج والمبادرات، التقارير
  - Super admin: الرئيسية، المستخدمون، الجمعيات، البرامج والمبادرات، الإعدادات، سجل التدقيق
  - Supervisor: الرئيسية، قائمة أعمالي، الطلبات، الجمعيات، النماذج، التقارير
  - Association officer: الرئيسية، طلباتي، طلب جديد، المستندات (published templates)، ملف الجمعية
  - Sections inside an item use a tab row under the band (`TabNav`): super admin «البرامج والمبادرات»
    (programs, objectives, attachment types, templates, extraction review) and «الإعدادات» (general,
    request statuses); unit manager «البرامج والمبادرات» (programs, objectives, templates, request
    lifecycle).
- Below `lg` the items move into a green drawer opened from the band.

## Green band

- The band holds **navigation, page title and key figures**: `AppShell` renders the navigation
  row, and each page continues the band with `<PageBand>` (eyebrow, title with gold rule, optional
  lead text, actions and `<BandFigures>`). The pattern continues seamlessly across both parts.
- **It fades softly into the ivory page**: the band and its pattern extend 32px and dissolve
  through a mask (`.band-fade`). Content never sits in the fading strip.
- **Nothing overlaps the band**: no floating sheet, no translucent cards, no glassmorphism. Cards
  start below it.
- **Key figures** (from A): one row separated by hairlines; each figure has a label, the number in
  large white numerals (key figure in gold), an optional unit and a small caption, e.g. «منذ بداية
  العام». A percentage with no data shows a dash with a caption.
- List and detail pages use the compact band so data stays above the fold.

## Cards and content

- Below the band: bordered surface cards (sharp corners, hairline border, faint shadow) on the
  ivory page, as in C.
- Card headers use the gold diamond heading; no divider under the heading.
- **Status** is a small coloured dot plus plain text (`<StatusText>`), never a filled tag.
- **Request information** (initiative, audience, location, duration) is plain label-over-value
  pairs, not tinted boxes.
- **Zero** renders as ٠ (never a diamond or an empty glyph); missing values render as —.
- **Empty states** are designed for every block: a short sentence and, where it makes sense, a
  primary action. Pages must look finished with zero data.
- Every screen has loading (band skeleton plus card skeletons), empty, error and permission-denied
  states.

## Login

- Split screen as in C: the form panel on the reading side, a green panel with the pattern and the
  white logo on the other side. The panel headline is exactly
  «الوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين» (no vision statement).
- Form order: username, password, forgot-password link, primary login button, then the Nafath
  button with the visible simulated-service notice below it.
- The same split layout serves forgot password, reset password and the forced password change.
  Below `lg` the green panel becomes a band at the top.

## Dashboards (design stop 2)

- **Unit manager:** the band shows a small time-based greeting (صباح الخير before noon, مساء الخير
  after, Asia/Riyadh time) above the large title «نظرة عامة على الإشراف», the Hijri date, and the
  key figures: إجمالي الطلبات، مفتوحة، متأخرة عن المهلة، متوسط المعالجة، نسبة الاعتماد، غير مسندة,
  each with a caption. Cards: status distribution (stacked bar and legend), monthly incoming requests
  (last six Hijri months), requests by program, supervisor workload, overdue requests (placed high
  on the page). All numbers from the database; designed empty states for every block.
- **Super admin, supervisor, association officer:** same shell, band and card system, using their
  existing data blocks restyled; role-appropriate content only, no new data features.

## Requests list (Phase 3)

- Big status numbers above the table (as in C) acting as filters; a search and filter row;
  numbered pagination; initial circles beside supervisor names; status as dot plus text; medium row
  density.
- **Row actions:** for requests under review, approve / return / reject icons appear on hover or
  keyboard focus (always visible on touch), only for the responsible supervisor and the unit
  manager.
- **Confirmation modal** (centred) for every action: request title and reference, the chosen
  action, a required reason field for return and reject, cancel and confirm (confirm coloured by
  action). Esc closes.
- **Bulk actions:** a leading checkbox column; when rows are selected a bar appears with
  اعتماد المحدد / إعادة للتعديل / رفض, plus إعادة إسناد to a supervisor for the unit manager only.
  - Return and reject need one reason, applied to every selected request.
  - The same centred modal shows the count and the selected titles.
  - Every request still gets its own status-history and audit entry.
  - Only in-review requests inside the user's scope are selectable; the server re-checks and
    reports out-of-scope or non-review requests as skipped.
  - If some fail, the others proceed and a result summary lists the skipped ones.
  - Maximum 25 per bulk action, adjustable in settings (Phase 2).

## Request detail (Phase 3)

- No repeated button row in the header.
- A sticky «القرار» decision panel in the side column with the three choices and the reason field;
  at tablet width it becomes a fixed bottom bar.
- Timeline as in C: diamond nodes with the connector line between nodes.
- No vertical divider between the timeline and the main column, and no horizontal separator lines
  between description, attachments and conversation; spacing separates them.
- Conversation is a flat thread (no chat bubbles). Internal notes have a gold side rule and the
  label «ملاحظة داخلية — للفريق فقط», and remain inaccessible to association officers through every
  route, list, export, print view and PDF.

## Building blocks (code)

| Component | File |
|---|---|
| `AppShell`, `PageBody`, `PageSkeleton` | `src/components/layout/app-shell.tsx` |
| `PageBand`, `BandFigures` | `src/components/layout/page-band.tsx` |
| `TopNav`, `MobileNav` | `src/components/layout/top-nav.tsx`, `mobile-nav.tsx` |
| `AuthSplit` | `src/components/layout/auth-split.tsx` |
| `Panel`, `PanelHeader`, `SectionTitle`, `StatusText`, `Alert`, `Skeleton` | `src/components/ui/surface.tsx` |
| `EmptyState`, `ErrorState`, `ForbiddenState` | `src/components/states/states.tsx` |
| `RefNumber` | `src/components/ui/ref-number.tsx` |
| `GeometricPattern` | `src/components/brand/geometric-pattern.tsx` |
| `ObjectiveHeaderCells`, `ObjectiveCells`, `ObjectiveLegend` (7-column objective grid) | `src/components/taxonomy/objective-grid.tsx` |
| `PrintButton`; print rules (`data-print="hide"`, A4 landscape, light palette) | `src/components/ui/print-button.tsx`, `src/app/globals.css` |
| Fonts | `src/app/fonts.ts`, `public/fonts/cairo/` |
| Tokens | `src/styles/tokens.css`, `src/app/globals.css` |
