# Design system

The approved visual design for Rifada is the **design handoff v2** (`design_handoff_rifada_platform`,
private material, see docs/ONBOARDING.md), aligned with prh.gov.sa: official greens, the gold of the
Rifada logo, cool neutrals, the gov.sa banner and a white header carrying both logos. It replaced
direction C (Heritage panel) on 2026-10-25 at the owner's request (D-092). Every screen, including
those built in later phases, follows this document.

Decisions here are settled; change them only with the owner's approval. Technical background is in
`docs/DECISIONS.md` (D-020 onward, D-092 for this design).

## Principles

- Official, calm and welcoming government product; the strategy and the Haramain are visible on the
  public pages.
- Dense where data lives, generous on public pages.
- No emoji, no dashed borders, no glassmorphism, no gradient blobs, no stock imagery. Photographs are
  only the Presidency's own photographs of the Two Holy Mosques (`public/images/haramain/`, taken from
  the strategy outline), on public pages.
- One line-icon set: Lucide, stroke 1.75, sizes `size-4` inline, `size-[18px]` in navigation,
  `size-5` in state icons. Navigation items carry an icon.
- Right-to-left with logical properties only (`ms-/me-/ps-/pe-`, `start/end`, `border-s/e`).
  `npm run lint` rejects physical-direction utilities and emoji.

## Typography

- **Font:** Cairo for everything (kept by the owner instead of the handoff's IBM Plex Sans Arabic).
  Self-hosted with `next/font/local` in `src/app/fonts.ts`; the files live in `public/fonts/cairo/`
  so the PDF renderer (Phase 6, Playwright) loads the same files through the same pages.
- **Digits:** Arabic-Indic (٠١٢٣٤٥٦٧٨٩) everywhere, through `formatNumber` / `toArabicDigits` /
  `<RefNumber>`. Cairo's own Arabic-Indic digits are proportional and the font has no `tnum`
  feature, so a derived digits-only face, "Rifada Cairo Tabular Digits"
  (`scripts/fonts/build_tabular_digits.py`), puts every digit on one equal, deliberately tight width
  and is stacked before Cairo (approved by the owner). Its ٠ is a filled round dot, the conventional
  Arabic zero.
- **Roles** (defined once in `src/app/globals.css`, components layer):

  | Class | Use | Size / weight |
  |---|---|---|
  | `t-page` | Page title (page head), brand green | 2rem / 700 |
  | `t-section` | Section and card titles | 1.0625rem / 700 |
  | `t-label` | Field labels, column headers, figure labels | 0.8125rem / 600, `ink-subtle` |
  | `t-body` | Running text | 0.9375rem / 400, line-height 1.85, `ink-muted` |
  | `t-figure` | Key figures and counts | size per context / 700, tabular |
  | `t-table` | Table text | 0.875rem, tabular |
  | `t-caption` | Notes, timestamps, helper text | 0.75rem, `ink-subtle` |

- **Eyebrows and section headings** start with a 7px gold diamond (`<Diamond>`, `<SectionTitle>`).

## Shape and elevation

- **Radii** (set once in `globals.css`): `rounded-xs` 4, `rounded-sm` 8 (small buttons, icon
  buttons), `rounded-md` 10 (buttons, inputs), `rounded-lg` 12 (tiles, alerts, menus),
  `rounded-xl` 14 (cards, key figures), `rounded-2xl` 20 (login hero and card, home bands).
  The header avatar is a rounded square (9px); status dots and radios are round.
- Elevation is led by hairline borders: `shadow-1` cards, `shadow-2` hover and the login card,
  `shadow-3` menus and modals.
- Inputs: 40px (48px on the login form), `line-strong` border; focus turns the border green with a
  3px ring of 20% green. Focus outline elsewhere: 3px gold, offset 2px.

## Colour

Tokens live in `src/styles/tokens.css`; Tailwind utilities are mapped in `globals.css`.
`npm run contrast` checks every text/background pair in both themes (WCAG AA 4.5:1 for text, 3:1 for
accents, focus rings and chart marks) and the chart palette under simulated protanopia and
deuteranopia. Handoff colours were darkened slightly where they failed AA (primary, gold, warning);
the chart palette kept its earlier colour-blind-checked values.

| Token | Role | Light | Dark |
|---|---|---|---|
| `canvas` | Page | `#f5f6f4` | `#0c120f` |
| `surface` | Cards, header, page head | `#ffffff` | `#131b17` |
| `surface-muted` / `surface-sunken` | Table headers, hover / tracks, gov banner | `#f8f9f8` / `#eef1ef` | `#18211d` / `#1e2924` |
| `line` / `line-strong` | Hairline / input border | `#e5e9e6` / `#c9d1cc` | `#25312c` / `#3a4943` |
| `ink` / `ink-muted` / `ink-subtle` | Text levels | `#161b18` / `#4b5751` / `#5d6a63` | `#eef2ef` / `#b4c0ba` / `#96a39c` |
| `brand-ink` | Page titles, system name | `#074d31` | `#eef2ef` |
| `band` / `band-2` / `band-deep` | Green surfaces / hover / footer | `#074d31` / `#0a5c3b` / `#03281a` | `#0b3a26` / `#0f442d` / `#06170f` |
| `band-ink` / `band-ink-muted` / `band-gold` | Text and gold on green | `#ffffff` / `#c6d8ce` / `#d8c48f` | `#f4f7f5` / `#b7cbbf` / `#d8c48f` |
| `primary` | Primary action, links | `#177a4d` | `#4fbf89` |
| `accent` / `accent-ink` | Gold marks (non-text) / gold text | `#a38439` / `#7f6529` | `#c8a95a` / `#d8c48f` |
| `gold-action` | Gold button (role call-to-action, page-head actions) | `#8a6f2e` | `#c8a95a` |

- **Buttons** (`<Button>`): `primary` green, `dark` deep green (login, header sign-in), `gold` /
  `onBand` gold, `outline` white with a green hover border, `ghost` green text, `danger` red
  outline, `outlineOnBand` on green surfaces. Heights 34 / 42 / 50. `cn` does not merge Tailwind
  classes, so add a variant rather than overriding a variant's colours through `className`.
- **Status colours** are fixed and separate from the chart palette: `st-neutral`, `st-info`,
  `st-review`, `st-warn`, `st-ok`, `st-bad`, each with a `-soft` background.
- **Chart palette** (six colours, colour-blind checked): green `chart-1`, gold `chart-2`, teal
  `chart-3`, slate blue `chart-4`, terracotta `chart-5`, sand `chart-6` on `chart-track`.
- **Notices** (`<Alert>`): soft status tint, hairline border of the status colour, 4px side rule,
  icon in the status colour, text in ink.
- **Dark mode** is designed, not inverted: deep green-black base, lighter greener levels, light green
  primary with dark text, softened status colours. The Presidency's full-colour logo sits on a small
  white plate in dark mode.

## Brand motifs

- **Ogee arch** of the Rifada logo (`<ArchOutline>` in `src/components/brand/arch.tsx`, `.arch-mask`
  in `globals.css`): faint outline at the end of the page head (7%), on the featured key figure, the
  login hero and the green home bands; photographs on the home page are framed by it.
- **Gold diamond** (`<Diamond>`) as eyebrow and section marker.
- **Geometric pattern** (`<GeometricPattern>`, khatam lattice, faint gold stroke about 8 to 10%) on
  green surfaces only: navigation bar, login hero, home hero and bands. Never behind body text on
  white surfaces.

## App shell

From top to bottom (`AppShell`):

1. **Gov banner** (`<GovBar>`, 38px): Saudi flag, «موقع حكومي رسمي تابع لحكومة المملكة العربية
   السعودية», the «كيف تتحقق» toggle opening the gov.sa and HTTPS explanations, and today's Hijri date.
2. **Header** (`<SiteHeader>`, white, sticky, 84px): the Presidency's logo, a hairline, the Rifada logo
   and the system name «منصة رفادة» (from xl) at the start; theme toggle, the user chip (rounded-square
   initial, name, role or association) and sign out at the end. Below lg the drawer button sits at
   the start.
3. **Navigation bar** (green, 56px, pattern): icon plus label per item; active item white with a 4px
   gold bar; unavailable items dimmed and not clickable; the role's gold call-to-action at the end
   (`NAV_CTA` in `src/config/nav.ts`). Below lg the items move into a green drawer.
4. **Page head** and **page body**, then the copyright bar (`<AppFooter>`).

- **Items per role** (short lists; items whose screens arrive in later phases are shown as
  unavailable, not clickable, and become links when their phase ships):
  - Unit manager: الرئيسية، الطلبات، الإسناد، الجمعيات، البرامج والمبادرات، التقارير
  - Super admin: الرئيسية، المستخدمون، الجمعيات، البرامج والمبادرات، الإعدادات، سجل التدقيق
  - Supervisor: الرئيسية، قائمة أعمالي، الطلبات، الجمعيات، النماذج، التقارير
  - Association officer: الرئيسية، طلباتي، طلب جديد، المستندات (published templates)، ملف الجمعية
  - Sections inside an item use a tab row (`TabNav`): super admin «البرامج والمبادرات»
    (programs, objectives, attachment types, templates, extraction review) and «الإعدادات» (general,
    request statuses); unit manager «البرامج والمبادرات» (programs, objectives, templates, request
    lifecycle).

## Page head

- `<PageBand>` (historical name) is the white page head: eyebrow with a gold diamond, title in brand
  green, optional lead (max 680px) and actions at the end, and the faint arch at the end. Inside it
  `.page-head` remaps the on-band colours to ink, so actions and eyebrows written for the former
  green band stay legible; `.band-scope` restores them on green elements inside it.
- **Key figures** (`<BandFigures>`) follow the head on the canvas as a row of cards (label, large
  figure, unit, caption); the emphasised one is the featured green card with an arch outline. A
  percentage with no data shows a dash with a caption.
- List and detail pages use the compact head so data stays above the fold.

## Cards and content

- Bordered white cards (`<Panel>`, 14px radius, hairline border, `shadow-1`) on the canvas.
- **Card header** (`<PanelHeader>`, handoff `.ch`): a 36px icon tile (soft green, or gold for
  guidance and attention; a gold diamond when the card has no icon), title, subtitle and tools at
  the end, then a hairline. A table placed right after it starts at that hairline
  (`.panel-head + [data-table]`). `flush` drops padding and hairline for headings inside a padded
  box. Card footers (dashboard cards) hold a hint and a ghost link.
- **Status** is a pill (`<StatusText>`): soft tint of the status colour, a dot and the name.
- **Key figures** (`<BandFigures>`): icon tile and label, figure, caption; the first card is the
  featured green card; `href` makes a card a link to the filtered list; `emphasis` turns the tile
  gold and marks the caption. Icons come from the page or from the label map in
  `src/components/layout/figure-icons.tsx`.
- **Quick actions** (`<QuickActions>`): a row of shortcut tiles under the key figures on every
  dashboard, real routes only.
- **Breadcrumbs** are derived from the navigation (`<Breadcrumbs>` inside the page head): home of
  the role, the active item, the current page.
- **Tables**: header row on `surface-muted` between hairlines, 13px semibold labels, middle-aligned
  cells, row hover; references in green semibold; pagination as 34px bordered squares, current in
  deep green. The list toolbar is one compact row (labels kept for screen readers).
- **Empty states** use the handoff's arch illustration (green outer arch, gold inner arch, icon).
- **Request information** (initiative, audience, location, duration) is plain label-over-value pairs.
- **Zero** renders as ٠; missing values render as —.
- Empty states are designed for every block: a short sentence and, where it makes sense, a
  primary action. Pages must look finished with zero data.
- Every screen has loading (head skeleton plus card skeletons), empty, error and permission-denied
  states.

## Login

- Gov banner and the header with both logos (theme toggle only), then a grid: the green hero panel
  over the al-Masjid al-Haram photograph (20px radius, pattern, large arch outline, the motto beside the logo, «منصة حكومية موثّقة» tag, white logo, the headline
  «الوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين», a lead, and three feature tiles:
  تقديم إلكتروني، متابعة فورية، دخول آمن) and the white form card (470px, a green-to-gold top rule), with the registration card «جمعية جديدة؟
  سجّلوا جمعيتكم في المنصة» and the tracking link under it (login page only, through `after`).
- Form order: username, password, forgot-password link, the dark primary login button, then the
  Nafath button (green-bordered tile with a fingerprint icon) with the visible simulated-service
  notice.
- The same layout serves forgot password, reset password and the forced password change. Below `lg`
  only the card shows.

## Association registration (D-094)

- `/register`: a green head with the five-step progress bar, then a sticky side card (the step's
  Haramain photograph under a green fade, a gold icon tile, a line of the strategy) with the step
  list, and the form card (step header, content, footer bar with السابق / التالي or the submit).
  Programme cards as on the new-request page; the values as numbered gold-diamond tiles; the pledge
  in a gold-bordered box; a summary before submitting.
- Success: a green panel over the Kaaba photograph with the arch and check, the reference number
  with a copy button, «ماذا بعد؟» in three steps, the vision line, and links to tracking and home.
- `/register/status`: lookup form beside a result card (status pill, explanation, dates, reason or
  login link).
- Admin: `/admin/registrations` (key figures, tabs by status, table) and the application page
  (association, programmes, officer cards; the decision panel with approve and reject dialogs).

## Public home page (Phase 5, first part)

Sections in order (`src/app/(public)/page.tsx`, `src/components/home/home-sections.tsx`):

1. **Hero** (green, pattern): the Presidency's name, the unit's name, the strategy's motto
   «مباركًا وهدًى للعالمين», what Rifada is, login and «تعرّف على المبادرة» buttons, key figures
   counted from the database (programmes, available initiatives, objectives, values), and the Kaaba
   photograph inside the arch.
2. **Leadership statements**: the statements of the Custodian of the Two Holy Mosques (green card)
   and of the Crown Prince (ivory card) with their portraits in a gold ring and a green arc, as on
   the strategy outline's opening pages, then the opening word of the President of Religious
   Affairs with his portrait. Portraits come from the strategy outline
   (`public/images/leadership/`).
3. **Vision and mission** (database), with photographs of al-Masjid al-Haram and al-Masjid an-Nabawi.
4. **Values** (database), numbered in gold diamonds, beside the Haram arches photograph.
5. **Strategic objectives** (database, green band); the four the supervision initiative serves
   (1, 5, 6, 7) are marked «تخدمه المنصة» with how.
6. **Programmes** (database, available ones only) with their available-initiative counts.
7. **The initiative**: introduction, summary, the procedural and technical tracks, the Presidency's
   supervisory tasks, the four implementation phases, beneficiaries and expected impact
   (`src/config/initiative.ts`, from the initiative document).
8. **How supervision works**: the four request steps, then a closing login band and the full footer.

The public header adds in-page section links (lg and up) and a dark «الدخول إلى المنصة» button. The
footer (`<SiteFooter>`, `band-deep`) holds the white logo with a short description, links to the home
sections, the login and password pages and the Presidency's official site, and the copyright bar. No
invented contact details or social links.

## Request pages

- **Detail**: the page head carries the status pill; under it a card with the four-step stepper
  (`<RequestStepper>`: تقديم الطلب، فحص الاكتمال، المراجعة الفنية، القرار; done green, current gold with
  a halo, rejected red) and the key facts in icon cells. Each section (description, initiative
  data, attachments, completeness, conversation) is its own card. The side column holds the
  «القرار» panel (green-bordered, approve green, return amber outline, reject red outline), the
  assignment, the status timeline (tinted round icons per status, notes in a muted box) and the
  audit trail.
- **New request**: the programmes are selectable cards with their icons (`<ProgramIcon>`) and
  available-initiative counts, then the initiative; beside the form the step guide
  (`<FormSteps>`), which also accompanies the edit page. The edit form is split into numbered
  sections with a footer bar for submit and save.

## Dashboards (design stop 2)

- **Unit manager:** the page head shows a small time-based greeting (صباح الخير before noon, مساء الخير
  after, Asia/Riyadh time) above the large title «نظرة عامة على الإشراف», the Hijri date, and the
  key figures: إجمالي الطلبات، مفتوحة، متأخرة عن المهلة، متوسط المعالجة، نسبة الاعتماد، غير مسندة,
  each with a caption. Cards: status distribution (stacked bar and legend), monthly incoming requests
  (last six Hijri months), requests by program, supervisor workload, overdue requests (placed high
  on the page). All numbers from the database; designed empty states for every block.
- **Super admin, supervisor, association officer:** same shell, page head and card system.
  Supervisor: quick actions, the queue sorted by nearest deadline, overdue requests, status
  distribution. Association: «طلب يحتاج إلى تعديلكم» notice when a request is returned, quick
  actions, the latest submitted request with its stepper, recent requests and the submission
  guide. Admin: quick actions, users by role, latest audit entries.

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
| `AppShell`, `PageBody`, `PageSkeleton`, `HeadSkeleton` | `src/components/layout/app-shell.tsx` |
| `GovBar`, `SiteHeader`, `SiteFooter`, `AppFooter` | `src/components/layout/gov-bar.tsx`, `site-header.tsx`, `site-footer.tsx` |
| `Logo`, `PresidencyLogo`, `ArchOutline`, `Diamond` | `src/components/brand/logo.tsx`, `arch.tsx` |
| Home page sections and content | `src/components/home/home-sections.tsx`, `src/config/initiative.ts`, `src/server/services/public-site.ts` |
| `PageBand`, `BandFigures` | `src/components/layout/page-band.tsx` |
| `TopNav`, `MobileNav` | `src/components/layout/top-nav.tsx`, `mobile-nav.tsx` |
| `AuthSplit` | `src/components/layout/auth-split.tsx` |
| `Panel`, `PanelHeader`, `SectionTitle`, `StatusText`, `Alert`, `Skeleton` | `src/components/ui/surface.tsx` |
| `EmptyState`, `ErrorState`, `ForbiddenState` | `src/components/states/states.tsx` |
| `RefNumber` | `src/components/ui/ref-number.tsx` |
| `QuickActions`, dashboard cards (`RecentRequestsCard`, `OverdueCard`, ...) | `src/components/dashboard/quick-actions.tsx`, `cards.tsx` |
| `RequestStepper`, `FormSteps`, `StatusTimeline` | `src/components/requests/request-stepper.tsx`, `form-steps.tsx`, `timeline.tsx` |
| `Breadcrumbs`, key-figure icons | `src/components/layout/breadcrumbs.tsx`, `figure-icons.tsx` |
| `ProgramIcon` | `src/components/brand/program-icon.tsx` |
| `GeometricPattern` | `src/components/brand/geometric-pattern.tsx` |
| `ObjectiveHeaderCells`, `ObjectiveCells`, `ObjectiveLegend` (7-column objective grid) | `src/components/taxonomy/objective-grid.tsx` |
| `PrintButton`; print rules (`data-print="hide"`, A4 landscape, light palette) | `src/components/ui/print-button.tsx`, `src/app/globals.css` |
| Fonts | `src/app/fonts.ts`, `public/fonts/cairo/` |
| Tokens | `src/styles/tokens.css`, `src/app/globals.css` |
