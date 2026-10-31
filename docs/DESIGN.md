# Design system

The approved visual design for Rifada is the **design handoff v2** (`design_handoff_rifada_platform`,
private material, see docs/ONBOARDING.md), aligned with prh.gov.sa: official greens, the gold of the
Rifada logo, cool neutrals, the gov.sa banner and a white header carrying both logos. It replaced
direction C (Heritage panel) on 2026-10-25 at the owner's request (D-092). Every screen, including
those built in later phases, follows this document.

Decisions here are settled; change them only with the owner's approval. Technical background is in
`docs/DECISIONS.md` (D-020 onward, D-092 for this design, D-095 for the upgrade of cards, key
figures, icons, navigation, logos and timeline).

## Principles

- Official, calm and welcoming government product; the strategy and the Haramain are visible on the
  public pages.
- Dense where data lives, generous on public pages.
- No emoji, no dashed borders, no glassmorphism, no gradient blobs, no stock imagery. Photographs are
  only the Presidency's own photographs of the Two Holy Mosques (`public/images/haramain/`, taken from
  the strategy outline), on public pages.
- One line-icon set: Lucide, stroke 1.75 for every icon (set once in `globals.css` on
  `svg.lucide`). Sizes by role: 16 (`size-4`) in text and buttons, 18 (`size-[18px]`) in the
  navigation, 20 (`size-5`) in tiles and page states; 14 (`size-3.5`) only beside 12–13px captions
  (breadcrumbs, gov banner, footer link, sort arrows). Navigation items carry an icon.
- **One icon per concept** (`src/components/layout/nav-icon.tsx` and the pages): requests Inbox,
  templates and documents FileStack, users UsersRound, adding a user UserRoundPlus, assignment
  UserRoundCheck, registration applications ClipboardList, reports ChartColumn, objectives Target,
  initiatives Lightbulb. Icons are kept where they help find or understand something (navigation,
  actions, status, programmes); card headers and key figures carry none.
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
  Arabic zero; a redrawn zero (hollow or filled lozenge) was reviewed and declined (D-095).
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

- **Eyebrows and section headings** start with a gold diamond (`<Diamond>` 7px in eyebrows;
  `<SectionTitle>` and card headers 8px, `<HeaderDiamond>`).

## Shape and elevation

- **Radii** (set once in `globals.css`): `rounded-xs` 4, `rounded-sm` 8 (small buttons, icon
  buttons), `rounded-md` 10 (buttons, inputs), `rounded-lg` 12 (tiles, alerts, menus),
  `rounded-xl` 14 (cards, key figures), `rounded-2xl` 20 (login hero and card, home bands).
  The header avatar is a rounded square (9px); status dots and radios are round. No other values:
  tab bars sit in 14px cards, icon tiles are 10px, link cards are 14px (D-095).
- Elevation in three distinct steps (`tokens.css`): `shadow-1` cards and key figures, `shadow-2`
  standalone forms (login, registration) and hovered cards, `shadow-3` menus and dialogs. Boxes
  inside cards carry no shadow. In dark mode levels 1 and 2 add a faint top light, because a drop
  shadow alone does not show on a dark surface.
- Inputs: 40px (48px on the login form), `line-strong` border; focus turns the border green with a
  3px ring of 20% green. Focus outline elsewhere: 3px `--focus`, offset 2px; `--focus` is green
  in light and gold in dark. Interactive cards draw it inside (offset −3px).

## Motion

- One motion for every hover and focus change: 200ms, ease-out (`--motion-duration`,
  `--motion-ease`; Tailwind's default transition uses them, so every `transition-*` utility
  follows).
- Page entry: the head, then the key figures (`.fade-up-1`), then the body (`.fade-up-2`) fade up
  4px, 70ms apart.
- `prefers-reduced-motion`: transitions, animations, the page entry and hover lifts are off;
  loading spinners keep turning.

## Interactive cards

- Every card that is a link or a selectable option uses `.card-link` (`globals.css`): on hover the
  border turns green in light and gold in dark, the shadow rises to `shadow-2` and the card lifts
  1px; keyboard focus draws the ring inside the card. A selected option keeps its green border and
  inset ring and does not lift. Controls (buttons, pagination, table rows) keep their own states.
- Key-figure tiles that are not links use `.card-hover` (part of `FIGURE_TILE`): on hover only the
  border changes, green in light and gold in dark. **Every other card does not react to hover**
  (panels, empty states, tab bars, «القرار», login, registration and home cards): a hover on
  something that cannot be clicked suggests a link that is not there (owner, D-095).
- These hover rules sit **outside** the CSS layers in `globals.css` on purpose: Tailwind's
  utilities (a card's own `border-line`, `shadow-1`) would otherwise override them. Keep them
  there.

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
  white plate in dark mode, padded by its clear space with a hairline.

## Brand motifs

- **Ogee arch** of the Rifada logo (`<ArchOutline>` in `src/components/brand/arch.tsx`, `.arch-mask`
  in `globals.css`): faint outline at the end of the page head (7%), the login hero and the green
  home bands; photographs on the home page are framed by it. Not on key figures (D-095).
- **Gold diamond** (`<Diamond>`) as eyebrow and section marker.
- **Geometric pattern** (`<GeometricPattern>`, khatam lattice, faint gold stroke about 8 to 10%) on
  green surfaces only: navigation bar, login hero, home hero and bands. Never behind body text on
  white surfaces.

## App shell

From top to bottom (`AppShell`). The gov banner, header and navigation bar span the **full width
of the screen** (padding only, no cap), so the logos and the navigation reach the edges on wide
screens. The page head spans the full width too (title at the start edge, date or actions at the
end edge); key figures, cards and the footer stay at **1360px**, centred (D-095). On
signed-in pages the white header and the green bar **stick to the top together** on scroll
(152px from lg); sticky side columns sit at `lg:top-[168px]` and in-page anchors use
`lg:scroll-mt-44`. Public, login and registration pages keep only the white header sticky.

1. **Gov banner** (`<GovBar>`, 38px): Saudi flag, «موقع حكومي رسمي تابع لحكومة المملكة العربية
   السعودية», the «كيف تتحقق» toggle opening the gov.sa and HTTPS explanations, and today's Hijri date.
2. **Header** (`<SiteHeader>`, white, sticky, 88px; 72px below sm): the platform's identity leads
   at the start (Rifada logo 52px and «منصة رفادة» with the unit line, text from lg); theme
   toggle, the user chip (rounded-square initial, name, role or association) and sign out follow
   at the end. The Presidency's logo is no longer in the header (owner's request, 2026-10-28,
   replacing D-095): its white version sits in the public footer under «الرئاسة». Below lg the drawer button sits at the start. The login and public pages use
   the same header.
3. **Navigation bar** (green, 64px, pattern): icon plus 16px semibold label per item, full-height
   click targets; active item white text on a `white/10` fill with a 4px gold bar across the item;
   hover a `white/6` fill; unavailable items at 60% white with a not-allowed cursor and a tooltip;
   the role's 44px gold call-to-action at the end (`NAV_CTA` in `src/config/nav.ts`). From 1024 to
   1279px the item icons hide and the padding tightens so seven items and the call-to-action fit;
   full padding from 1536px. Below lg the items move into a green drawer (16px semibold items, the
   same active fill and gold side rule).
4. **Page head** and **page body**, then the copyright bar (`<AppFooter>`).

- **Items per role** (short lists; items whose screens arrive in later phases are shown as
  unavailable, not clickable, and become links when their phase ships):
  - Unit manager: الرئيسية، الطلبات، الإسناد، الجمعيات، البرامج والمبادرات، التقارير
  - Super admin: الرئيسية، المستخدمون، الجمعيات، البرامج والمبادرات، الإعدادات، سجل التدقيق
  - Supervisor: الرئيسية، قائمة أعمالي، الطلبات، الجمعيات، النماذج، التقارير
  - Association officer: الرئيسية، طلباتي، النماذج (published templates)، ملف الجمعية، المساعدة (D-102)
  - Sections inside an item use a tab row (`TabNav`): super admin «البرامج والمبادرات»
    (programs, objectives, attachment types, templates, extraction review) and «الإعدادات» (general,
    request statuses); unit manager «البرامج والمبادرات» (programs, objectives, templates, request
    lifecycle).

## Page head

- `<PageBand>` (historical name) is the white page head, full width with side padding: eyebrow
  with a gold diamond, title in brand green, optional lead (max 680px) and actions at the end, and the faint arch at the end. Inside it
  `.page-head` remaps the on-band colours to ink, so actions and eyebrows written for the former
  green band stay legible; `.band-scope` restores them on green elements inside it.
- **Key figures** (`<BandFigures>`) follow the head on the canvas as a row of identical white cards
  (label, large figure, unit, caption). A percentage with no data shows a dash with a caption.
- List and detail pages use the compact head so data stays above the fold.

## Cards and content

- Bordered white cards (`<Panel>`, 14px radius, hairline border, `shadow-1`) on the canvas.
- **Card header** (`<PanelHeader>`): one style for every card: an 8px gold diamond
  (`<HeaderDiamond>`) on the title's first line, title, subtitle and tools at the end, then a
  hairline. No icon tiles. The request page sections and side cards, «القرار», «إجراءات الطلب»,
  «خطوات الطلب», the registration form and the status lookup use the same diamond. A table placed
  right after it starts at that hairline (`.panel-head + [data-table]`). `flush` drops padding and
  hairline for headings inside a padded box. Card footers (dashboard cards) hold a hint and a
  ghost link.
- **Status** is a pill (`<StatusText>`): soft tint of the status colour, a dot and the name.
- **Key figures** (`<BandFigures>`, `FIGURE_TILE` in `page-band.tsx`): every tile the same white
  card with the label, the figure (2rem) and a caption; no icon tile, no featured green tile, no
  arch. Colour only when a figure needs attention (`attention`: `bad` red for overdue, `warn` amber
  for unassigned, returned, awaiting review or decision, uncertain cells), on the figure and as a
  dot before the caption, and only while the count is above zero. `href` makes the tile a link to
  the filtered list (an interactive card; the arrow shows on hover and focus only).
- **Request list status filters** use the same tile; the selected filter has a gold top bar and a
  green border (gold in dark).
- **Dashboards are the exception (D-097):** the three role dashboards use the handoff's key
  figures (`KpiRow`: icon tile, featured green first tile), shortcut tiles (`QuickActions`) and
  icon-tile card headers; see «Dashboards» below. Every other page follows the rules above.
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
   «مباركًا وهدًى للعالمين», what Rifada is, login and registration buttons, key figures
   counted from the database (programmes, available initiatives, objectives, values), and the
   **leadership statements** one at a time (D-096): portrait in a gold ring with an arc, the
   statement, honorific, name and title, rotating every seven seconds with dots and a pause
   button. The statements, their portraits and order are managed on `/admin/settings/home`; the
   super admin picks one of two looks: a cream card (`accent-soft`) with the portrait over its top
   edge, or a translucent card with a gold border. With none published, the Kaaba photograph in
   the arch takes their place.
2. *(The separate leadership section was folded into the hero, D-096.)*
3. **Vision and mission** (database), with photographs of al-Masjid al-Haram and al-Masjid an-Nabawi.
4. **Values** (database), numbered in gold diamonds, beside the Kaaba and clock tower photograph cut
   to the outer silhouette of the rosary frame, with the frame drawn over it (`masba7a`, dark
   variant in dark mode, D-098).
5. *(Strategic objectives, green band: hidden at the owner's request, D-098.)*
6. **The initiative**: introduction, summary, the procedural and technical tracks, the Presidency's
   supervisory tasks, beneficiaries and expected impact
   (`src/config/initiative.ts`, from the initiative document), then the full footer.

The programmes section, «كيف يعمل الإشراف الفني», the closing login band and the initiative's
«مراحل التنفيذ» were removed at the owner's request (D-095), with their header and footer links.

The public header adds four in-page section links in page order (القيادة، الرؤية والرسالة، القيم،
المبادرة), grouped together from 1280px, starting under the end of «كيف تتحقق» in the gov banner, with hairlines between them
(`SiteHeader`'s `middle` slot), and a gold «الدخول إلى المنصة» button (`gold`, like the hero). The footer's «عن المنصة»
links follow the same order. The
footer (`<SiteFooter>`, `band-deep`) holds the white logo with a short description, links to the home
sections, the login and password pages and the Presidency's official site with the Presidency's white
logo (72px) below it, and the copyright bar. No invented contact details or social links.

## Request pages

- **Detail** (staff; associations have their own page in the same structure, D-103): the page head carries the status pill; under it a card with the four-step stepper
  (`<RequestStepper>`: تقديم الطلب، فحص الاكتمال، المراجعة الفنية، القرار; done green, current gold with
  a halo, rejected red) and the key facts in icon cells. Each section (description, initiative
  data, attachments, completeness, conversation) is its own card. The side column holds the
  «القرار» panel (green-bordered, approve green, return amber outline, reject red outline), the
  assignment, the status timeline «مسار الطلب» (the shared diamond timeline, latest entry gold) and
  the audit trail.
- **New request and the request form** belong to the association and follow «Association
  interface» (D-102, D-103): the steps at the side as on the registration page; programme cards,
  then the initiatives as a list of choices with a search box, then the wizard (one subject per
  step, a review step, saving between steps).

## Timeline

- One component (`src/components/ui/timeline.tsx`: `Timeline`, `TimelineItem`, `TimelineTitle`,
  `TimelineText`): a 1px `line-strong` connector and 10px diamond markers, title as the main line
  and a smaller muted line beneath, 24px between entries. Markers: `current` gold, `done` green,
  `muted` grey. Used by «مسار الطلب» (history on the staff request page). Do not build another.

## Dashboards (design stop 2, revised by D-097)

- The three role dashboards follow the handoff closely: key figures with icon tiles and the
  featured green first tile (`KpiRow`), shortcut tiles with real counts (`QuickActions`, unit
  manager and association), card headers with the 36px icon tile, the arch empty state in cards,
  deadline pills in request tables. Building blocks: `src/components/dashboard/kpis.tsx`,
  `cards.tsx`.
- **Unit manager:** the page head shows a small time-based greeting (صباح الخير before noon, مساء الخير
  after, Asia/Riyadh time) above the large title «نظرة عامة على الإشراف», the Hijri date, and the
  key figures: إجمالي الطلبات، مفتوحة، متأخرة عن المهلة، متوسط المعالجة، نسبة الاعتماد، غير مسندة,
  each with a caption. Cards: status distribution (stacked bar and legend), monthly incoming requests
  (last six Hijri months), requests by program, supervisor workload, overdue requests (placed high
  on the page). All numbers from the database; designed empty states for every block.
- **Super admin, supervisor, association officer:** same shell, page head and card system.
  Unit manager adds: requests per programme split into decided and open, the monthly card
  comparing submitted with decided over 3, 6 or 12 months, and the workload table with programmes,
  load share and a link to each supervisor's requests.
  Supervisor: «مراجعة الطلب التالي», the queue card with tabs (all, by status, overdue) and a
  table sorted by nearest deadline, then status distribution and overdue requests.
  Association (D-103): the key figures, a notice per returned request with the supervisor's note
  and per draft, the latest requests with their next step, and how a request moves. Admin
  (unchanged, D-095 style): users by role, latest audit entries.

## Association interface (D-102, D-103)

The association officers are often older and less used to web applications. Their area uses the
platform's own components at their usual sizes, so it looks like the rest of the platform, with
these rules on top (`src/components/association/`).

- **Larger by default, once.** The area opens at «كبير» (112.5% of the root size); the «حجم الخط»
  control in the header (and the phone menu, and the sign-in pages) offers 100%, 112.5% and 125%,
  kept on the device. Components keep the design system's sizes; do not enlarge them again. Where a
  layout depends on how much text fits (the requests table, the request page's facts), switch it
  with a container query in rem, which follows the chosen size, not with a screen breakpoint.
- **The official status names**, as everywhere (`StatusText`). Beside a status say what it means,
  the next step and whose turn it is, from `lib/association-status.ts` («مطلوب منكم» in amber,
  «لدى الوحدة الإشرافية» in grey). Never invent other labels for the statuses.
- **Facts, not general sentences:** dates (sent, last update, returned, decided), the supervisor's
  note with its date, the review time left or the review period in working days, what is missing,
  the number of templates per programme.
- **One worded button per request** («إكمال الطلب», gold «تعديل الطلب», «عرض الطلب»); no icon-only
  buttons. Gold marks «تقديم طلب جديد» and correcting a returned request.
- **Lists:** requests in a table with the next step (`AssocRequestsTable`), or a list of entries
  where the table has no room; status tiles as filters and a search, as on the staff list; pages
  with «الصفحة السابقة / التالية» (`ListPager`). Templates are filtered by programme from a side list.
- **Forms:** label, then its explanation with an example, then the control, then the error; every
  field is required unless marked «(اختياري)» (`FormField`). A new request follows the registration
  page: the steps at the side (`StepsAside`; «الخطوة ٢ من ٥» on phones) and one card per step
  (`StepCard`), saving between steps and on leaving a field, a review step with a checklist.
- **Help** is a page of its own («المساعدة») and is linked from the home page.

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
- Timeline as in C: diamond nodes with the connector line between nodes (the shared timeline).
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
| `Panel`, `PanelHeader`, `HeaderDiamond`, `SectionTitle`, `StatusText`, `Alert`, `Skeleton` | `src/components/ui/surface.tsx` |
| `Timeline`, `TimelineItem`, `TimelineTitle`, `TimelineText` | `src/components/ui/timeline.tsx` |
| `FIGURE_TILE`, `FigureChevron` (key-figure tile, also the request list filters) | `src/components/layout/page-band.tsx` |
| `.card-link`, `.card-hover`, motion, reduced motion, icon stroke | `src/app/globals.css` |
| `EmptyState`, `ErrorState`, `ForbiddenState` | `src/components/states/states.tsx` |
| `RefNumber` | `src/components/ui/ref-number.tsx` |
| Dashboard key figures and shortcuts (`KpiRow`, `QuickActions`) | `src/components/dashboard/kpis.tsx` |
| Dashboard cards (`RequestsTableCard`, `CardTabs`, `OverdueCard`, `SlaPill`, ...) | `src/components/dashboard/cards.tsx` |
| Home hero statements (`HeroQuotes`) and their admin page | `src/components/home/hero-quotes.tsx`, `src/components/admin/home-quote-controls.tsx` |
| `RequestStepper`, `StatusTimeline` | `src/components/requests/request-stepper.tsx`, `timeline.tsx` |
| Association interface: `AssocRequestsTable`, `NextStep`, `RequestAction`, `BackLink`, `ListPager` (`parts.tsx`), `FormField`, `StepsAside`, `StepCard` (`fields.tsx`), `NewRequestPicker`, `RequestWizard`, `AttachmentCard`, `FileRow`, `AssociationMessages`, `AssociationRequestView`, `AssociationProfileForm` | `src/components/association/` |
| `TextSizeControl` (text size, D-102) | `src/components/layout/text-size.tsx` |
| `Breadcrumbs`, `NavIcon` (the icon per concept) | `src/components/layout/breadcrumbs.tsx`, `nav-icon.tsx` |
| `ProgramIcon` | `src/components/brand/program-icon.tsx` |
| `GeometricPattern` | `src/components/brand/geometric-pattern.tsx` |
| `ObjectiveHeaderCells`, `ObjectiveCells`, `ObjectiveLegend` (7-column objective grid) | `src/components/taxonomy/objective-grid.tsx` |
| `PrintButton`; print rules (`data-print="hide"`, A4 landscape, light palette) | `src/components/ui/print-button.tsx`, `src/app/globals.css` |
| Fonts | `src/app/fonts.ts`, `public/fonts/cairo/` |
| Tokens | `src/styles/tokens.css`, `src/app/globals.css` |
