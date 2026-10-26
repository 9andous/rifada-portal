# Decisions log

Small and medium decisions taken during the build, with the reason. Newest at the bottom of each phase.

## Phase 1a — Foundation

**D-001 Versions (checked 2026-10-21 against npm and official docs).**
Next.js 16.4.2, React 19.3, Better Auth 1.7.12, Tailwind CSS 4.3.3, Prisma 7.10.1, TypeScript 6.0.3,
ESLint 9.39 with eslint-config-next 16.4.2, Vitest 5.0.5, Playwright 1.64.1, Zod 4.6.
- Prisma: the npm `latest` tag points to `8.0.0-rc.24`, a release candidate with a completely new
  API (contracts instead of `schema.prisma`, no `PrismaClient`). Better Auth's Prisma adapter supports
  Prisma 5–7 only. We use the latest **stable** line, 7.10.1, following its current conventions:
  `prisma-client` generator with explicit `output`, `prisma.config.ts` holding the datasource URL and
  seed command, `@prisma/adapter-pg` driver adapter, ESM.
- TypeScript: 7.0 is the native (Go) compiler and no longer ships the JavaScript compiler API;
  typescript-eslint requires `<6.1`, and Next.js needs an experimental flag for TS 7. We use 6.0.3.
- Next.js 16: `middleware.ts` is deprecated and renamed `proxy.ts` (Node.js runtime by default); we
  use `src/proxy.ts`. The 16.4 starter enables Cache Components and Partial Prefetching; we keep both
  and place every session read behind `<Suspense>`. `forbidden()` is still experimental, so area
  layouts render the permission-denied state themselves and the proxy answers HTTP 403.
- ESLint 9 rather than 10: the Next.js 16.4 starter pins `eslint@^9`.

**D-002 npm instead of pnpm.** pnpm is not installed on the development machine and Corepack would
need administrator rights to enable it. npm with a lockfile gives the same reproducibility here.

**D-003 Better Auth specifics.**
- Better Auth requires an email per user. Accounts created without one get
  `<username>@no-email.rifada.invalid` (reserved TLD, never deliverable). Password reset by email is
  only possible once a real email is recorded; the dev email service logs the link to the console.
- Accounts are created by writing the `users` row plus a `credential` account directly
  (`src/server/auth/users.ts`), because public sign-up is disabled.
- Disabled endpoints: sign-up, username availability (prevents enumeration), update-user,
  change-email, delete-user, set-password, social linking. Profile changes will go through Rifada's
  own audited actions.
- Rate limits: sign-in 5/min per IP, password reset request 3/5 min, reset 5/5 min, change 5/5 min,
  mock Nafath 5/min. Server actions that call `auth.api` directly also use an in-memory limiter
  (`src/server/services/rate-limit.ts`), because direct API calls bypass Better Auth's HTTP limiter.
  In-memory storage suits the single-instance local deployment; use a shared store before scaling out.
- Sessions last 8 hours, refreshed hourly. A `session.create.before` hook refuses sessions to
  deactivated accounts for every sign-in method; the proxy and `getCurrentUser()` also re-check
  `isActive`, so deactivation takes effect on the next request.
- `revokeSessionsOnPasswordReset` is on; changing a password revokes other sessions.
- Password policy: at least 10 characters with a Latin letter and a digit; argon2id (19 MiB, t=2, p=1).

**D-004 Mock Nafath.** Implemented as a Better Auth plugin (`src/server/identity/nafath-mock-plugin.ts`,
marked MOCK) so the session is created by Better Auth itself. `start` stores a two-minute transaction
(random two-digit code) in the verifications table and reveals nothing about whether an account
exists; `complete` consumes it once and signs in the active account whose optional `nationalId`
matches. The UI shows a visible "بيئة محاكاة" notice. A real provider implements `IdentityProvider`.

**D-005 Route protection layers.** Proxy (session + role area, 403 via rewrite to `/forbidden`) →
area layout guard → scoped queries and `can()` in every action. The proxy only queries the database
when a session cookie is present on a protected path or `/login`.

**D-006 Theme persistence uses localStorage**, applied by an inline script before first paint (the
pattern from the Next.js "preventing flash before hydration" guide). A cookie would force every page,
including the public ones, to render dynamically under Cache Components.

**D-007 Dates and digits.** All formatting uses `Intl` with the `islamic-umalqura` calendar and
`arab` numbering system in the `Asia/Riyadh` time zone, so server and browser output match exactly.
The Arabic-Indic zero renders as «٠», which is the correct glyph.

**D-008 Fonts.** IBM Plex Sans Arabic (400–700) and Noto Kufi Arabic (500–700), Arabic and Latin
subsets only, self-hosted from `@fontsource` 5.3.0 files in `public/fonts` with an `@font-face` file
(`src/styles/fonts.css`). Plain `@font-face` rather than `next/font/local` so the same files and
unicode ranges can be reused by the PDF renderer in Phase 6. Licences (SIL OFL) are kept next to the files.

**D-009 Brand tokens.** Sampled from the logo and strategy document: green `#387868`/`#2F6B5C`, deep
green `#24473B`, gold `#A88830`/`#BFA457`, ivory `#FBF9F3`. Primary actions use green-700 `#275A4D`
(7.9:1 on white). Gold-500 on white is only 3.4:1, so gold is used for rules, borders, focus rings
(gold-600) and large display; gold text uses gold-700 (5.6:1). `npm run contrast` checks 22 pairs in
both themes.

**D-010 Logo.** One config file, `src/config/brand.ts`. Light surfaces use the colour PNG; dark mode
and deep-green surfaces use the white @4x PNG. Images are never recoloured.

**D-011 Database for tests.** A second database, `rifada_test`, is created by the Postgres init script.
The test runner applies migrations to it and truncates tables between tests; it refuses to run if the
test URL equals the development URL. Postgres is exposed on port 5433 to avoid clashing with local
database servers.

**D-012 Development accounts.** `npm run db:seed:dev-users` creates one account per non-admin role,
with the password from `DEV_USERS_PASSWORD` in `.env`. They and their association are flagged
`isDemo` so the Phase 7 demo wipe removes them. The super admin comes only from `SEED_ADMIN_*`.

**D-013 Request statuses.** Seeded as data with stable keys (`DRAFT` … `REJECTED`) that the workflow
engine relies on; names are editable. Transitions are data too; transitions with no roles are
system-only (completeness check, automatic move to review). The super admin is not part of review.

**D-014 Second migration.** Prisma 7 refuses `migrate reset` without explicit user consent, so the
removal of the unused `displayUsername` column is a small second migration instead of a rewritten
initial one.

**D-015 Public home page (foundation version).** Phase 1a ships only the hero and login entry; the
full page is Phase 5. No figures are shown.

## Design lab (between Phase 1a and 1b)

**D-016 Design lab route.** `/dev/design-lab` compared three visual directions (the lab and its
notes are not part of the public repository; private material, see docs/ONBOARDING.md). It exists only in development: `src/proxy.ts` answers 404 for `/dev/*` in
production before rendering, and the pages call `notFound()` as a second guard. Verified with
`next build` + `next start`: 404 with no lab content in the body. Its illustrative data is
hard-coded in the lab and never reaches the database.

**D-017 Zero glyph.** Noto Kufi Arabic draws the Arabic-Indic zero as a diamond; IBM Plex Sans
Arabic draws the correct round ٠. Figures must use Plex; headings use a combined face with Kufi
letters and Plex digits. To be applied to the real app with the chosen direction.

**D-018 Reference numbers and bidi.** Arabic-Indic digit groups separated by hyphens are reordered
even inside an LTR span; references render in `<bdi dir="ltr">` with the hyphens wrapped in
left-to-right marks. To be applied to the real app with the chosen direction.

**D-019 UI rules script** ignores comment lines when checking for physical-direction utilities
(prose such as "right-to-left" was a false positive).

## Design application, stop 1

**D-020 Cairo and tabular digits.** Cairo 3.13 (via @fontsource-variable/cairo 5.3.0, Arabic and
Latin subsets, variable weight) replaces IBM Plex Sans Arabic and Noto Kufi Arabic in the app; the
lab keeps its own copies. Cairo's Arabic-Indic digits are proportional (250 to 678 units wide) and
the font has no `tnum` feature, so `font-variant-numeric` cannot align them. With the owner's
approval a digits-only face, "Rifada Cairo Tabular Digits", is derived from Cairo by
`scripts/fonts/build_tabular_digits.py` (fontTools): static instances at 400/500/600/700, every
digit on one common width with its ink centred, separators unchanged. The first build used the
widest digit's width (678 units at 400), which left ١ and ٠ floating apart in times such as ٤:١١ م
and years such as ٢٠٢٦; after the owner's review the common width was tightened to 486 units at
400 (0.80 of the widest ink plus side bearings), condensing only ٣ ٥ ٧ ٨ horizontally by 13 to 22%.
Composite Extended Arabic-Indic digits are flattened first so each digit can be reshaped. It is stacked before Cairo
with `unicode-range`; `next/font/local` fallback metrics are disabled on the first two faces so a
system fallback can never take Arabic glyphs first. Cairo is OFL with no Reserved Font Name; the
derived face has its own name and stays under the OFL. Approved by the owner after reviewing
the lab's digits specimen. In stop 2 the zero glyph was also replaced: Cairo's ٠ is a small square
that read as an empty or missing glyph at figure sizes, so the derived face draws a filled round
dot (about 1.9 times the width of Cairo's square, centred in the digit cell). Correction to D-017: IBM Plex Sans Arabic's Arabic-Indic digits are also proportional.

**D-021 Tokens.** Direction C's lab values became the app tokens (`src/styles/tokens.css`), with
app aliases kept for existing utilities (`success`, `danger`, ...). Every radius step is 2px.
`npm run contrast` checks 67 pairs per theme plus the chart palette's minimum CIE76 difference
(15) under simulated protanopia and deuteranopia (Machado 2009). Terracotta and sand were tuned
(light `#923f26`; dark `#bb7650` / `#c2b388`) to pass.

**D-022 Band fade.** The band's soft edge is a CSS mask (`.band-fade`) on the band itself, so the
green and the pattern dissolve together; a separate gradient strip left a hard line where the
pattern ended.

**D-023 Auth route group.** Login, forgot password, reset password and the forced password change
moved into `src/app/(auth)` (no public header) to use the split layout. URLs are unchanged.

**D-024 Navigation items for later phases** are listed per role but rendered as unavailable
(`aria-disabled`, not links) until their phase ships, instead of linking to missing pages.

**D-025 Notices.** `<Alert>` is a plain surface with a coloured side rule and icon; tinted
backgrounds were dropped because amber and brown tints turn muddy in dark mode.

## Design application, stop 2

**D-026 Dashboard figure definitions** (`src/server/services/dashboard.ts`, tested in
`tests/integration/dashboard.test.ts`). All figures use `scopeRequests`.
- Staff totals leave drafts out (unsubmitted work belongs to the association); the association
  dashboard shows its own drafts as a caption.
- Open = submitted, completeness check, under review, returned. Overdue = submitted, completeness
  check or under review with `slaDueAt` in the past (returned requests wait on the association, and
  the SLA restarts on resubmission). Unassigned = open with no supervisor.
- Average handling = mean calendar days from submission to decision (working days arrive with the
  Phase 4 SLA logic); approval rate = approved / (approved + rejected). Both render «—» with a
  caption when nothing has been decided.
- Monthly figures bucket `submittedAt` by Umm al-Qura month in Asia/Riyadh time.
- **Open item for Phase 3:** `scopeRequests` currently lets supervisors (within their programs) and
  the unit manager read associations' drafts. The dashboards never display them to staff, but the
  requests list and detail must exclude drafts from staff scope. Not changed in the design stop,
  which may not alter data access.

## Phase 1b — Taxonomy extraction

**D-027 Extraction method.** The 11 initiative tables in the strategy outline (private PDF; pages 18, 20,
21, 23, 24, 25, 27, 29, 31, 32, 34) are raster images. Each was read twice:
- Reading A: automated pixel analysis of the extracted 3530px images (table grid from the dark rule
  lines, share of checkbox colour per cell). Every cell came out either empty (0) or clearly
  checked (about 0.3); no cell fell between.
- Reading B: visual reading of enlarged crops of the objective columns, row by row.
- The two readings agree on all 1,001 cells (143 initiatives x 7 objectives): 670 links, no
  uncertain cell. `uncertainObjectives` stays in the seed format so a later correction can mark one.
  Reading B was done after Reading A had run, so the two are not fully blind to each other; Reading
  A is fully automatic and independent of any visual judgement.
- Initiative names were transcribed from the images and checked a second time by rendering each
  transcription under its source row. Program goals come from the numbered goal tables of the same
  pages; the poster text layer of the programs overview (private PDF) was used only as a word check (the
  poster lists fewer goals for programs 3 and 7 and words some differently; the strategy document
  wins). Goal counts: 12 / 13 / 19 / 7 / 17 / 5 / 6.

**D-028 Taxonomy seed** (`prisma/seed/taxonomy.json`, loaded by `prisma/seed/taxonomy.ts` from
`npm run db:seed`). Create-only and idempotent: existing programs, goals and initiatives are never
updated, so Phase 2 edits survive a re-seed. The JSON keeps per initiative the source page, the
objective numbers, the original wording where a typo was fixed (`sourceText`) and the merged rows of
program 1, initiative 2 (`mergedRows`). The schema has no source-page column; the review page reads
pages from the JSON and compares the database with it (`differsFromSource`).

**D-029 Accepted ambiguity defaults applied.** Program 6 is shown as «برنامج الحسبة والتوعية
الميدانية» with the long PDF name in `officialName`; its numbering keeps the gap at 25 (1–24, 26–28;
noted in `numberingNote`); program 1 initiative 2 is one initiative «تطبيق الحرمين الشريفين (ويشمل
نسخة الواقع الافتراضي VR)»; same-name initiatives (P6/23 and P7/4 «تبيان ودلالة»; P4/10 and P6/26
«منتخبات موشن جرافيكس من فتاوى إجابة السائلين») are separate records.

**D-030 Spacing typos fixed in initiative names** (21; nothing else in the wording was changed —
trailing full stops and colons in the source are kept and listed in `docs/COPY-REVIEW.md`):

| Program / initiative | Source | Stored |
|---|---|---|
| 1 / 3 | مركز أذان و تلاوات الحرمين الشريفين | مركز أذان وتلاوات الحرمين الشريفين |
| 2 / 2 | منصة وتطبيق حرمين الإثر ائية لتعليم العلوم الشرعية | منصة وتطبيق حرمين الإثرائية لتعليم العلوم الشرعية |
| 2 / 12 | إعداد محتوىاللوحات الإرشادية العلمية المتغيرة | إعداد محتوى اللوحات الإرشادية العلمية المتغيرة |
| 2 / 21 | مشروع توعية الجاليات العاملة بمشاريع المسجد الحرام (المحاضرات والدروس  العلمية) | مشروع توعية الجاليات العاملة بمشاريع المسجد الحرام (المحاضرات والدروس العلمية) |
| 3 / 18 | برودكاست قصص من الحر مين | برودكاست قصص من الحرمين |
| 3 / 19 | الحقيبة القر آنية | الحقيبة القرآنية |
| 3 / 20 | اقتباسات وفو ائد من دروس أصحاب المعالي والفضيلة مدرسي المسجد الحرام | اقتباسات وفوائد من دروس أصحاب المعالي والفضيلة مدرسي المسجد الحرام |
| 4 / 10 | منتخبات موشن جر افيكس من فتاوى إجابة السائلين | منتخبات موشن جرافيكس من فتاوى إجابة السائلين |
| 4 / 11 | دليل المر اكز استشارية يحال إليها السائلون | دليل المراكز استشارية يحال إليها السائلون |
| 4 / 14 | بوت على التليجرام والو اتس اب للأسئلة المتكررة | بوت على التليجرام والواتس اب للأسئلة المتكررة |
| 4 / 15 | مستشارين متخصصين في الجو انب الإيمانية والتربوية والسلوكية | مستشارين متخصصين في الجوانب الإيمانية والتربوية والسلوكية |
| 5 / 2 | برمجة وتطوير نظام إدارة الحلقات القر آنية بالمسجد الحرام | برمجة وتطوير نظام إدارة الحلقات القرآنية بالمسجد الحرام |
| 5 / 3 | حلقات تحفيظ القرآن الكريم للقاصدين والز ائرين، وتصحيح تلاوتهم، وتأهيل المتسابقين للمسابقات القر آنية. | حلقات تحفيظ القرآن الكريم للقاصدين والزائرين، وتصحيح تلاوتهم، وتأهيل المتسابقين للمسابقات القرآنية. |
| 5 / 9 | البرنامج القر آني المكثف لحفظ القرآن الكريم وتلاوته في رحاب المسجد الحرام | البرنامج القرآني المكثف لحفظ القرآن الكريم وتلاوته في رحاب المسجد الحرام |
| 6 / 1 | المعرض التوعوي الإثر ائي | المعرض التوعوي الإثرائي |
| 6 / 3 | الحملات التوعوية الإرشادية باللغات (كتيبات إلكترونية وموشن جر افيكس) | الحملات التوعوية الإرشادية باللغات (كتيبات إلكترونية وموشن جرافيكس) |
| 6 / 5 | "تواصل"الموسم الثاني | "تواصل" الموسم الثاني |
| 6 / 10 | صلوا كما ر أيتموني أصلي | صلوا كما رأيتموني أصلي |
| 6 / 11 | المشاركة بالمعارض في المسجد الحرام وخارجه (بمصحف بر ايل) | المشاركة بالمعارض في المسجد الحرام وخارجه (بمصحف برايل) |
| 6 / 26 | منتخبات موشن جر افيكس من فتاوى إجابة السائلين | منتخبات موشن جرافيكس من فتاوى إجابة السائلين |
| 7 / 12 | محتسبو ن | محتسبون |

In goal 4 of program 6 an unmatched closing quotation mark after «والعمرة» was dropped. Spaces that
the PDF text layer inserts after tanwin (e.g. «مرجعً ا») are extraction artefacts, not source typos,
and were removed.

**D-031 Review page and taxonomy view.** `/admin/taxonomy` (read-only, program list plus the
selected program's goals and initiative grid) and `/admin/taxonomy/review` (super admin only,
printable). Both loaders check permissions themselves (`taxonomy.read`, and `admin.access` for the
review), on top of the admin area guard. The program selector reads `searchParams`, so that part
streams behind its own Suspense boundary.

**D-032 Print.** Dark tokens now apply under `@media screen` only, so printed pages always use the
light palette. The app navigation and the green band carry `data-print="hide"`; print uses A4
landscape. Phase 6 reports reuse this.

**D-033 Development super admin for screenshots.** The seeded admin still has its first-login
password change pending, which only the owner should complete. For local screenshots a
`dev.admin` super admin (flagged `isDemo`, password from `DEV_USERS_PASSWORD`) was created in the
development database by a one-off script, not by committed code. It is removed with demo data or
can be deleted on request.

## Phase 2a, stop 1 — Users, associations, settings, audit log

Architecture answers from the owner (2026-10-24) are D-034 to D-036; the rest are small decisions
taken during the build.

**D-034 One-time passwords.** Creating a user, creating an association with its officer, and the
admin password reset generate a temporary password (`src/server/auth/temp-password.ts`: 14
characters from a 55-symbol alphabet without look-alikes such as 0/O and 1/l/I, about 80 bits, always
a Latin letter and a digit). It is returned **only in the server action's response**, held in the
client component's state and shown once with one copy button (`<OneTimeSecret>`). It is never stored
in plaintext (argon2id hash only), logged, audited, cached or put in a URL; refreshing or leaving the
page loses it, and «إنشاء حساب آخر» reloads the page so the value leaves memory. Accounts keep
`mustChangePassword` on. A reset also revokes every session of the account.

**D-035 Association deactivation cascades to the officer.** Deactivating an association deactivates
its officer account and deletes their sessions in the same transaction, with an audit entry for each.
Reactivating the association does not reactivate the officer; the admin does that on the user page,
and an officer cannot be reactivated while their association is inactive.

**D-036 CSV import (stop 2, approved, not built yet).** `csv-parse` (`csv-parse/sync`) on the
server; strict UTF-8 decoding with or without BOM; comma or semicolon detected from the header row;
stateless preview and confirm (the browser re-sends the same file, the server checks its SHA-256 and
re-validates every row before importing the valid ones in one transaction); blank officer usernames
generated from a short random id; a recovery message when a commit succeeded but its response was
lost. Not started until the owner says so.

**D-037 Account rules** (`src/server/services/admin/users.ts`, tested in
`tests/integration/admin-users.test.ts`).
- An admin cannot change their own role, deactivate themselves or reset their own password from the
  admin screen (they use «تغيير كلمة المرور»).
- The last active super admin cannot be deactivated or moved to another role.
- An officer account stays an officer and a staff account stays staff: converting either way is
  refused (deactivate and create a new account instead), so «one officer per association» can never
  be broken by a role change. Staff roles can change among themselves; leaving the supervisor role
  removes the program assignments.
- An officer is linked to exactly one active association with no other officer; the unique
  `users.associationId` column is the database backstop.
- Supervisors need at least one of the active programs.
- Account and association writes take one Postgres advisory transaction lock
  (`pg_advisory_xact_lock`), so the last-super-admin and one-officer checks cannot race. These
  writes are rare, so serialising them costs nothing noticeable.

**D-038 Usernames** are lowercase Latin letters, digits, «.» and «_», 3 to 40 characters, starting
with a letter or digit. This is Better Auth's username-plugin character set; a hyphen, which the
first draft allowed, would have created accounts that cannot sign in (caught by the integration
tests).

**D-039 Association fields.** Name and contact name are required; contact email, contact phone,
licence number, city, region and classification are optional (approved change 10; email and phone
made optional at the owner's review of stop 1). Optional values are still validated when given, and
empty ones are stored as null. A licence number is unique when set. Arabic-Indic digits typed in
phone or licence numbers are stored as ASCII digits and displayed as Arabic-Indic. Contact details
belong to the association record and are independent of the officer account's own email and phone.

**D-040 Audit snapshots** are built from explicit field lists (`userSnapshot`,
`associationSnapshot`, `{ key, value }` for settings) and pass through `redactSecrets()` in
`audit()`, which drops any key matching password/hash/token/secret at any depth (the
`mustChangePassword` flag is allowed). A user's placeholder email is recorded as null. Tests check
every audit row for generated passwords, the test password, argon2 strings and stored hashes. No
code path updates or deletes audit rows; a unit test scans `src`, `prisma` and `scripts` for one.
Saves that change nothing write no audit entry.

**D-041 Lists.** Search, filters, sort and page live in the URL (`src/lib/list-params.ts`) and are
submitted by a plain GET form (`<ListToolbar>`), so lists render on the server and work without
JavaScript; unknown values fall back to defaults. 20 rows per page (audit log: 50). Long forms submit
through `onSubmit` (`useActionForm`) instead of `<form action>`, because React resets a form after an
action and the admin would lose what they typed when the server refuses a value.

**D-042 Association registry access.** The list and detail loaders accept only roles whose
`associations.read` scope is `all` (super admin; unit manager read-only). The supervisor's
«associations I supervise» and the officer's «association profile» are later-phase screens and stay
unavailable in the navigation. Request counts on the association page leave drafts out (D-026).

**D-043 Settings.** `bulk.maxItems` (default 25) joins the settings. Limits: SLA 1 to 60 working
days, upload size 1 to 100 MB, bulk maximum 1 to 100, at least one upload group among PDF, Word,
Excel and images (video is not offered). Only changed keys are written and audited, each with before
and after; upload groups are stored in a fixed order so reordering is not a change. `demo.enabled`
is not editable here (Phase 7). The CSV maximum-rows setting arrives with stop 2.

**D-044 Audit date filters** are Riyadh calendar days (UTC+3, no daylight saving time): «from»
starts at 00:00 Riyadh, «to» includes the whole day. The date inputs are Gregorian (browser date
pickers); the Hijri equivalent is shown under each, and every row shows Hijri first with Gregorian
and the time.

**D-045 «إنشاء حساب مسؤول» on the association page** (owner's review of stop 1). An active
association without an officer shows a card with this button; it opens the same officer fields as
the «جمعية جديدة» step (`<OfficerFields>`) with the association fixed, and `createAssociationOfficer`
applies the same rules and audit as every other account creation (one officer per active
association, unique username and email, one-time password, `mustChangePassword`). The card stays
mounted when the page refreshes after creation, so the temporary password remains on screen until
the admin leaves the page. An inactive association must be reactivated first.

**D-046 Development database cleanup and the audit log.** `audit_logs.actorId` is `ON DELETE SET
NULL`, so deleting a user who performed audited actions would rewrite those audit rows. Test
accounts that acted are therefore deactivated (sessions removed) and left flagged `isDemo` instead
of deleted; the Phase 7 demo wipe must handle them the same way (or keep audit rows by design).

## Phase 2b, stop 1 — Taxonomy and requirements editors

Owner's answers (2026-10-24) are D-047 to D-053; the rest are small decisions taken during the build.

**D-047 Additive migration** `20261024125303_taxonomy_source_notes`: nullable `sourceNote` on
`programs`, `program_goals` and `strategic_objectives`, nullable `archivedAt` on `program_goals`. No
data change. Created with `prisma migrate dev --create-only`, inspected, applied with
`prisma migrate deploy` (which never resets); the development database was not reset.

**D-048 Original wording.** When a program name, goal text, initiative name or objective title is
first changed, «النص الأصلي قبل التعديل: «…»» is appended to the record's `sourceNote`
(`src/lib/original-wording.ts`). A note that already records an original (the Phase 1b typo notes)
is never touched again, so the source document's wording is never lost. The audit log also keeps the
full before/after.

**D-049 Requirement copy replaces all.** «نسخ المتطلبات إلى مبادرات أخرى» makes every target identical
to the source. The preview lists per target what is removed, overwritten (same key, different
content), unchanged and added; the server recomputes the targets on confirmation (archived
initiatives and the source are always excluded), replaces in one transaction and writes one
`requirements.copied` audit entry per target with the full before and after lists. An exact copy
includes attachment requirements whose type was archived later, since the targets must match.

**D-050 Two states.** «موقوف» (`isActive = false`): still listed everywhere, no new requests (enforced
in Phase 3). «مؤرشف» (`archivedAt`): retired, hidden from the request form, public pages and the
general taxonomy view, shown in the editors under the «مؤرشف/مؤرشفة» filter with a muted row and a
status mark, restorable. Nothing in the taxonomy is ever hard-deleted; a unit test scans `src/` for
delete calls on programs, goals, initiatives, objectives and attachment types.

**D-051 Keys are immutable.** Requirement keys and attachment-type keys are typed once at creation
and never accepted by an update (the update schemas omit them and the forms show them read-only).
Keys share one space per initiative (the database's `(initiativeId, key)` unique index); an
attachment requirement takes its type's key, so a type is required at most once per initiative.
Label, type, options, order and the required flag stay editable; changing a field's type away from
«قائمة اختيار» clears its options.

**D-052 Derived availability.** Pausing or archiving a program hides it and all its initiatives from
the request form and public pages without changing the initiatives' own flags
(`availableProgramWhere` and `availableInitiativeWhere` in `src/server/services/taxonomy.ts`);
reactivating or restoring the program brings them back as they were. The confirmation dialog states
how many initiatives are affected. `getTaxonomy()` applies it by default; the extraction review
passes `includePaused` so a paused program is not reported as missing. Paused initiatives (on their
own) stay visible.

**D-053 Strategic objectives** are edited (title and description) but never created or archived:
the 7-column matrix and the 7-checkbox editor are built on them. Linking is validated against the
existing objectives.

**D-054 Removing a requirement is allowed.** Requirements are not referenced by other rows: requests
will store values by requirement key (Phase 3 scope), so a removed requirement leaves submitted
data intact. Removal asks for confirmation and is audited with the full before value. Requirements
of an archived initiative are read-only until it is restored.

**D-055 Navigation.** Everything stays under «البرامج والمبادرات» (no new top-navigation items): a
section row (programs, objectives, attachment types, extraction review) and tabs on the program page
(initiatives, objective matrix, goals, data) and the initiative page (requirements, objective links,
data). Tabs are links (`?tab=`), so they are server-rendered and shareable. The unit manager's
«البرامج والمبادرات» is now active with read-only versions (`/manager/taxonomy`): programs, goals,
initiatives, matrix, objectives and requirements, archived records hidden.

**D-056 Attachment types.** Seeded create-only from `prisma/seed/attachment-types.json` (five
placeholder names, listed in `docs/COPY-REVIEW.md` for confirmation). At upload (Phase 3) the
accepted files are the type's groups intersected with `uploads.allowedGroups`; the editors flag a
type group that the settings currently disallow. Archived types stay on existing requirements,
marked, and are not offered for new ones.

**D-057 Validation details.** Field keys: `^[a-z][a-z0-9_]{1,39}$`, not one of the general request
fields (`title, description, targetAudience, location, startDate, endDate`, compared
case-insensitively). Select lists: 1 to 30 unique non-empty options, blank lines ignored. Program
numbers 1 to 99 and initiative numbers 1 to 999 (unique per program, also on renumbering);
Arabic-Indic digits are accepted in number fields. Goals are ordered by their number; moving a goal
swaps numbers through a temporary value inside the transaction.

**D-058 Wording slips.** The 10 entries of COPY-REVIEW «Taxonomy source wording» (11 initiatives)
are listed in `src/lib/wording-review.ts` and shown on `/admin/taxonomy` with an «تعديل» link to each
initiative; the edit form shows the note beside the name. An entry counts as resolved once the stored
name differs from the listed text. None was changed by the build.

## Phase 2b, stop 2 — Statuses, transitions and templates

Owner's answers (2026-10-24) are D-059 to D-064; D-065 onward are small decisions.

**D-059 Automatic transitions.** Additive migration `20261024150000_status_transitions_automatic`
(`isAutomatic BOOLEAN NOT NULL DEFAULT false`). An automatic transition has no roles and is never
triggered by a user (`canTriggerTransition` in `src/lib/workflow.ts`); a manual one needs at least
one role among association officer, supervisor and unit manager (the super admin is not part of
review, D-013). The seed sets the flag once on the three role-less default transitions (SUBMITTED →
COMPLETENESS_CHECK, COMPLETENESS_CHECK → UNDER_REVIEW, COMPLETENESS_CHECK → DRAFT) and never on a
row an admin has given roles.

**D-060 Fixed seven statuses.** No status is created or deleted; names, colours and order are
editable; keys and the terminal flag are not accepted by any action. Every transition change is
validated against the whole lifecycle inside the transaction (`validateLifecycle`): nothing leaves a
terminal status, every non-terminal status reaches a terminal one, no duplicates or self loops,
automatic ⇔ no roles. A transition (a rule, not a status) may be removed only when the remaining
lifecycle still passes; removals are audited with the full before value.

**D-061 Template file history.** Additive migration `20261024150100_template_files`: table
`template_files` (version, opaque storage key, original name, MIME, size, SHA-256, uploader, time)
plus nullable `templates.sha256` and `templates.currentFileId`. `templates` keeps the current file's
columns. Replacing a file adds a version; earlier files stay on disk and in the table, downloadable
by the super admin only. Both migrations were generated read-only with `prisma migrate diff` (the
interactive `migrate dev --create-only` stopped at a confirmation about the new unique index on an
empty table), split by hand, shown to the owner, and applied with `prisma migrate deploy` after the
owner's OK; `migrate status` then reported the schema up to date and a final diff was empty.

**D-062 Upload route and file types.** Files are streamed by a route handler
(`POST /api/admin/template-uploads`: raw body, URI-encoded name in `x-file-name`, same-origin check,
super admin only) into staging with a byte counter, so memory stays flat up to the settings limit.
Accepted: pdf, docx, xlsx, png, jpg/jpeg, webp only (owner): legacy .doc/.xls, every macro-enabled
format, SVG, HTML and video are refused. Each upload must pass all of: allowed extension, no second
known extension in the name («x.php.pdf»), declared MIME type for that extension, real content
detected by `file-type` equal to the extension (so DOCM content, a renamed ZIP or an EXE named .pdf
is refused), settings group (`word` ⇒ docx, `excel` ⇒ xlsx) and size. Names are cleaned (no folders,
control or bidi-override characters, at most 150 characters) and kept only as metadata.

**D-063 Storage.** `StorageService` with a local-disk implementation on `STORAGE_DIR` (default
`./storage`, git-ignored; refused inside `public/`). Keys are `templates/<32 random hex>` or
`staging/<32 random hex>` with no extension; every path goes through `resolveKey()`, which accepts
only that pattern and checks the resolved path stays inside the root. Files are served only by
`GET /api/templates/[id]/download`: always `Content-Disposition: attachment` (owner: no inline
exception) with an ASCII fallback and the Arabic name in `filename*`, `X-Content-Type-Options:
nosniff`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`; no CSP sandbox header
since nothing is rendered inline. Published, non-archived templates for any signed-in user;
unpublished, archived and earlier versions for the super admin; 404 otherwise.

**D-064 Staged uploads belong to their uploader.** A JSON sidecar next to the staged file records the
uploader, session, time, cleaned name, type, size and SHA-256 (no schema change). A staged upload is
consumed by an atomic rename into its permanent area, so it can be used once; only by the same
user; and only within one hour (expired files are removed when found and on every new upload). Every
refusal gives the same message, so upload ids reveal nothing. If saving the template fails after the
file moved, the moved file is removed again.

**D-065 Templates.** Created unpublished; publishing is a separate confirmed step. Archiving also
unpublishes; restoring leaves the template unpublished. An initiative chosen without a program sets
the program to the initiative's own; with a program it must belong to it; archived programs,
initiatives and attachment types cannot be chosen. Audit snapshots carry the file's name, size,
SHA-256 and version, never storage keys.

**D-066 Placement.** Super admin: «النماذج» in the «البرامج والمبادرات» section row; «حالات
الطلبات» as a tab of «الإعدادات» (`/admin/settings/statuses`). Unit manager: read-only «النماذج» and
«دورة حياة الطلب» in its «البرامج والمبادرات» row. Officer: «المستندات» (`/association/documents`)
lists published templates. Supervisor: a new «النماذج» item (`/supervisor/templates`). New
permissions `statuses.read` (super admin, unit manager) and `templates.read` (all four roles;
published templates are shared reference documents, not program-scoped).

**D-067 `file-type` 22.1.1** (released 2026-09-17), pinned exactly. 22.2.0 (2026-10-14) was the latest
but only ten days old at install time; 22.1.1 is the most recent release that had been out for
several weeks. It requires Node.js 22 or later (the project requires 24.11).

**D-068 Status colours** are the six status tones (neutral, info, review, warn, ok, bad) chosen in
the editor as dot swatches. The Phase 1a seed stored other tokens (`primary`, `warning`, `success`,
`danger`); they are read as review, warn, ok and bad (`statusTone`), and replaced when a status is
saved. The lifecycle diagram is an inline SVG on fixed positions for the seven statuses; automatic
transitions are drawn thinner and lighter (DESIGN.md forbids dashed lines) and the transitions table
carries the same information for assistive technology.

**D-069 Owner's review of stop 2.**
- *Mixed Arabic and Latin text.* A «و» written against a Latin word («وWord») is moved across the
  word by the bidi algorithm and read as a stray «g». Every Latin term inside Arabic text goes
  through `ltr()` (a left-to-right isolate, U+2066 … U+2069) and lists through `arabicList()` (Arabic
  comma, no glued «و»), both in `src/lib/format.ts`. The upload labels and `ALLOWED_FILE_TYPES_TEXT`
  in `src/lib/validation/settings.ts` are the single source for the settings page, attachment types,
  requirements, upload help and refusals. `scripts/check-ui-rules.mjs` (part of `npm run lint`)
  refuses an Arabic letter touching a Latin one; `tests/unit/bidi-text.test.ts` checks the texts.
- *Identical replacement.* Replacing a template's file with the same bytes as the current version
  (same SHA-256) is refused and no version is created; the committed copy is removed. An identical
  file to an older version is accepted, since it restores that content as a new version.
- *Empty list.* The super admin's empty templates list offers «نموذج جديد».
- The shared `<Alert>` coloured all four borders; it now colours only the side rule (DESIGN.md).

## Phase 3 — Requests core

Owner's answers at plan approval (2026-10-25) are D-070 to D-078; later entries are small decisions
taken during the build. Work happens on the local branch `phase-3`, one commit per milestone, merged
only after the owner's approval.

**D-070 Who decides.** Only the request's assigned supervisor and the unit manager approve, return
or reject. Other supervisors of the program read the request, comment and write internal notes, but
get no decision panel, row actions or selectable rows. An unassigned request under review can be
decided only by the unit manager. Enforced in the service on top of `requests.review`.

**D-071 Super admin and requests.** Read-only access to submitted requests: no decisions, comments
or assignment, no top-navigation item. Reached through `/admin/requests`, linked from the
association page and from audit-log entries. Every time the super admin opens a submitted request
or downloads one of its files, an audit entry is written (`request.viewed_by_admin`,
`request.file_downloaded_by_admin`) and shown in the request's audit trail. Drafts are never visible.

**D-072 Audit trail on the request page** is shown to the super admin and the unit manager only
(new permission `requests.auditTrail`), never to supervisors or officers.

**D-073 Discarding a draft.** A request that has never been submitted (`referenceNo IS NULL`) can be
deleted by its association: the row, its attachments, versions and completeness results are deleted
in one transaction and the files removed from storage after commit, with one
`request.draft_discarded` audit entry (title, program, initiative, file names and SHA-256; never
storage keys). A request that was ever submitted is never deleted.

**D-074 Upload and download routes.** `POST /api/requests/[id]/uploads` checks, before writing a
byte, that the user may upload to that request (officer: own draft or returned request; staff: a
comment file on a submitted request they can read), then streams into the stop 2 staging pipeline.
A server action commits the staged file to a requirement (new file), an attachment (new version) or
a comment. Files are served only by `GET /api/requests/[id]/files/[versionId]`.

**D-075 Association storage quota.** Setting `uploads.associationQuotaMb` (default 2048 as a
placeholder, range 100 to 51200). Usage is the size of every stored version on the association's
requests, drafts included (deleting a draft frees its space); files attached by staff to comments
are not counted. Checked when a staged file is committed.

**D-076 Virus scanning.** A `MalwareScanner` interface is called by the staging pipeline after the
magic-byte check, for templates and request files. The only implementation is a no-op marked as
such: **files are not virus-scanned today**, and no screen or document may say otherwise. The
Presidency's IT must choose the real scanner before production (ROADMAP «Open items before
production»); a scan-status column arrives with it.

**D-077 Requirements snapshot.** Additive migration adding `requests.requirementsSnapshot` (JSONB,
nullable). Each successful submission stores the initiative's requirements as they stood (key,
label, kind, field type, options, required flag, attachment type key and name). Submitted requests
are displayed and kept against the snapshot, so later edits or removals of requirements never change
or re-check what was submitted; drafts use the live requirements and are checked against them at
submission. Values stay in `customFields` by requirement key.

**D-078 Owner's changes at plan approval.** The «start date is today or later» rule applies only at
the first submission, not on resubmission of a returned request. Staff viewing a returned request
see the notice «قيد التعديل لدى الجمعية — قد يتغير محتوى الطلب قبل إعادة التقديم»: a returned
request stays visible to staff and the officer's in-progress edits are saved on the same request, so
staff see them as they are made.

**D-079 Draft privacy at the source.** `scopeRequests` adds `referenceNo IS NOT NULL`
(`SUBMITTED_ONLY`) to every staff scope (all and programs); `scopeComments` and the supervisor's
`scopeAssociations` inherit it. Only the officer's own-association scope includes drafts. A request
receives its reference number at its first successful submission and keeps it, so a returned
request stays visible to staff. This closes the D-026 open item; the dashboards needed no change.

**D-080 Working days.** `src/lib/working-days.ts`: Sunday to Thursday in Asia/Riyadh (UTC+3, no
daylight saving time), no public-holiday calendar yet. `addWorkingDays(from, n)` returns the end
(23:59:59.999 Riyadh) of the nth working day after the day of `from`; the submission day never
counts, and a weekend submission counts from Sunday.

**D-081 Staged uploads are bound to their context.** The staging sidecar records a context
(`request:<id>` for request and comment files; none for templates) and `consumeUpload` and
`peekUpload` require the same context, so a file staged for one request cannot be attached to
another. `peekUpload` lets a service validate a staged file (type against the requirement) before
consuming it, so a refused form keeps the upload usable. The shared route helpers (same-origin
check, file-name header) moved to `src/server/http/upload-route.ts`. Request files are stored in
the new `attachments/` storage area.

**D-082 Assignment rule** (`src/server/services/requests/assignment.ts`). Among the active
supervisors of the request's program: the fewest open requests (submitted, completeness check, under
review, returned), then the one assigned least recently (latest `AssignmentHistory` row naming them;
never assigned counts as earliest), then the username. A per-program advisory transaction lock makes
simultaneous submissions see each other's load. With nobody available the request stays unassigned,
the active unit managers are notified and the audit log records it; only the unit manager can decide
an unassigned request. On resubmission the current supervisor keeps the request while active and
still on the program. Reassignment (unit manager, reason required) covers open requests only;
drafts are invisible and decided requests are refused.

**D-083 Draft details.** Choosing the program and initiative creates the draft; both are fixed
afterwards (to change, delete the draft and start again). The officer saves with «حفظ المسودة»;
draft saves only check lengths and well-formed dates, and the completeness check decides what is
missing. Initiative values are stored as strings by requirement key; a save writes only keys of the
initiative's current field requirements and keeps stored values of removed ones (shown under «بيانات
أخرى»). Files can be removed only from a draft that was never submitted; a returned request only
receives new files or new versions.

**D-084 Completeness check details** (`src/lib/completeness.ts`, pure). Order: association,
program, initiative, the six general fields, dates, the initiative's fields, then required
attachments. Dates: both required; start not before today in Riyadh at the first submission only
(D-078); end not before start; span at most five years. Number fields accept Western or
Arabic-Indic digits; select values must be one of the options; an optional field is still
type-checked when filled. A required attachment needs at least one file of an accepted type (its
type's groups intersected with the settings). A failed check is persisted (`passed = false`, ranBy
RULES) and leaves the request in its status; a passed check moves it straight on. Resubmission is a
new submission, checked against the requirements as they stand then, and refreshes the snapshot.
`AIService` (`src/server/ai/ai-service.ts`) has only a mock and is not called.

**D-085 Decisions and concurrency.** Each decided request runs in its own transaction: scope
check, status must be under review, decider rule (D-070), the lifecycle data must allow the
transition for the role, then a conditional update (`WHERE status = under review`, and the
supervisor still assigned). A second click, a parallel decision or a reassignment in between
finds zero rows and is reported as skipped. Submission claims the row the same way, so a double
submission yields one reference number and one history. Bulk actions deduplicate ids, refuse more
than `bulk.maxItems` as a whole, and report each skipped request with a reason; requests outside
the user's scope are reported without title or reference.

**D-086 Comments and notifications.** Comments are immutable and threaded by `parentId`; the screen
shows a flat thread. Internal notes need `comments.writeInternal`; a public reply to an internal note
is refused (so the public thread never points at a hidden note), and officer views never carry
parent ids. Audit entries record a comment's length and files, not its text. Notification rows are
written in the transaction of the event (submitted/assigned, unassigned, reassigned, returned,
approved, rejected, resubmitted, comment, reply), never to the actor and never to an officer for an
internal note; links point to the recipient's own request page. Email and SMS remain stubs
(`ExternalNotifier`).

**D-087 Request audit entries** all use `entityType = "Request"` and the request id, including
files, comments and super-admin views, so the request's audit trail is one query. The trail shown
on the request page starts at the first submission; draft-period entries stay out like the draft.

**D-088 Screens.** Officer: «طلباتي» (`/association/requests`, drafts included), «طلب جديد»
(`/association/requests/new`: program then initiative, creating the draft), the form
(`/association/requests/[id]/edit`) and the request page. Supervisor: «قائمة أعمالي»
(`/supervisor/queue`: open requests assigned to them) and «الطلبات» (`/supervisor/requests`: all
submitted requests in their programs). Unit manager: «الطلبات» and «الإسناد» (`/manager/assignment`:
unassigned requests, requests held by deactivated supervisors, supervisor workloads in assignment
order). Super admin: `/admin/requests` with no navigation item, reached from the association page
(request count) and from request entries in the audit log. One shared list (`RequestListPage`) and
one shared request page (`RequestView`) serve every role; what they show and allow comes from the
server per role. The navigation marks the most specific matching item (`activeNavHref`).
«مقدَّم» and «فحص الاكتمال» last only for the instant of submission, so their big status numbers
are shown only when not zero. The request page's side column (decision panel, assignment,
timeline, audit trail) is sticky and scrolls on its own, so the «القرار» panel never covers the
timeline; below `lg` the decision is a fixed bottom bar.

**D-089 Requests table rendering.** `RequestsTable` renders its rows on the server; only the
checkboxes, the hover actions, the selection bar and the dialogs are client islands sharing one
selection context (`request-selection.tsx`). Date cells let the Hijri and Gregorian parts stack
(each part kept unbroken in `DateDisplay`) so the row actions stay inside the card.

**D-090 Intermittent hydration error in production builds (open, not caused by a known code
path).** Production builds (`next build` + `next start`, Turbopack, Partial Prerendering) log
React error #418 («hydration mismatch») on some page loads, sometimes followed by
`Cannot read properties of null (reading 'parentNode')` from the streaming scripts; the page then
re-renders on the client and works. Measured with headless Chromium on the screenshot database:
about 1 in 10 loads of the request lists and the request page; on `main` (Phase 2) 1 in 25 loads of
`/supervisor` and none in 25 of `/manager`. It never appears in `next dev`, where React would name
the mismatching element, and moving the requests table rows to the server, removing the band's
streamed figures or turning off link prefetching did not remove it. Recorded in ROADMAP «Open items
before production» for investigation (a React profiling build or the next Next.js patch release).
A stale incremental build can raise the rate sharply; the review screenshots (private material) were taken from a clean build.

**D-091 Safe deletes (incident during Phase 3 verification).** While investigating D-090 a
`git worktree` of `main` and a scratch copy of the project were made in the session's scratch folder,
each with a `node_modules` junction to this project's `node_modules`; their builds also created
`.next/node_modules/*` junctions (Turbopack links for `pg`, `@node-rs/argon2`, `@prisma/client`).
The cleanup commands were, in this order:
1. PowerShell `(Get-Item <copy>\node_modules).Delete()` for both copies (removes the junction only);
2. `git worktree remove --force <scratch>\wt-main` (failed part-way with «Filename too long»);
3. PowerShell `Remove-Item -Recurse -Force <scratch>\devcopy` (failed part-way on long paths);
4. Node `fs.rmSync(<scratch>\devcopy | wt-main, { recursive: true, force: true })`;
5. in the project, Git Bash `cd .next && for f in *; do [ "$f" != dev ] && rm -rf "$f"; done`.
One of the recursive deletes (2, 3 or 5) followed the `.next/node_modules` junctions and emptied the
three packages they point to. Every link these commands could meet pointed into
`<project>\node_modules` (listed after the incident: the only links in
the project are the six `.next/node_modules` and `.next/dev/node_modules` junctions to those three
packages, and `node_modules` itself contains no links), so nothing outside the project folder was
reachable; the other deleted paths were all inside the scratch folder. `npm install` restored the
three packages without changing `package.json` or `package-lock.json`, and all 1,002 locked packages
were checked present. Rule since then (CLAUDE.md): no raw recursive deletes on copies of the project
or on `.next`; use `scripts/safe-remove.mjs`, which unlinks every link without following it before
deleting and refuses paths outside its `--root`, the project folder and real `node_modules` folders
(tested in `tests/unit/safe-remove.test.ts`).

**D-092 Design handoff v2 replaces direction C (2026-10-25, owner's request).** The Presidency's
reviewer approved the design handoff (`design_handoff_rifada_platform`, private), aligned with
prh.gov.sa, and the owner asked for it across the whole platform, with a public home page that
carries the Presidency's strategy. Choices made with the owner:
- **Scope:** the whole platform. The token names stayed and only their values changed, so screens
  built in Phases 1 to 3 pick up the palette without edits. The shell was rebuilt (gov banner, white
  header with both logos, green navigation bar with icons and a role call-to-action, white page head,
  footer) and so was the login. `PageBand` keeps its name and API: `.page-head` remaps the on-band
  colours to ink inside it, and `.band-scope` restores them on green elements, so content written for
  the former green band needed no rewrite. Key figures moved below the head as cards.
- **Font:** Cairo is kept (the handoff's IBM Plex Sans Arabic was not adopted).
- **Logos and photographs are committed.** The handoff's Rifada and Presidency logos are in
  `public/brand/` and the placeholder marks are removed. The Haramain photographs on the home page
  come from the strategy outline (`public/images/haramain/`). The official vector logos are still
  to be requested.
- **Leadership statements** on the home page are text with name and title, without portraits.
- **Contrast:** handoff colours that fail WCAG AA were darkened slightly (primary `#177a4d`, gold
  marks `#a38439`, gold button `#8a6f2e`, warning `#985a00`); the chart palette keeps its earlier,
  colour-blind-checked values.
- **Home page content** comes from the database (SiteContent vision and mission, core values,
  strategic objectives, available programmes with available-initiative counts), so the unit's edits
  show without a release. The initiative texts and the leadership statements are fixed copy in
  `src/config/initiative.ts`. The handoff's sample contact details, social buttons and page-feedback
  bar were left out, because they would be invented or non-functional.

**D-093 Interior redesign and leadership portraits (2026-10-26, owner's request).** The owner found
the first pass of the handoff too plain inside the platform and asked for a richer interface, and
for the leadership portraits on the home page (reversing the text-only choice of D-092). Changes:
card headers with icon tiles and a hairline, status as pills, key-figure cards with icons and
links, quick actions on every dashboard, breadcrumbs from the navigation, the arch empty state,
the request stepper and per-section cards on the request page, programme cards on the new-request
page and a step guide beside the request form, and tinted timeline icons. Content stays real: every
figure and list comes from the database, quick actions point to existing routes only. Portraits of
the Custodian of the Two Holy Mosques, the Crown Prince and the President of Religious Affairs are
taken from the strategy outline. Fixed on the way: the request page's side column let its cards
shrink, which collapsed the decision panel (`[&>*]:shrink-0`). Lightning CSS dropped a
`:has(table)` rule, so the header-to-table rule uses a `data-table` attribute instead.

**D-094 Association self-registration (2026-10-26, owner's request).** Associations can apply from
the public site (`/register`), in a five-step journey: welcome (what joining means, what to
prepare), association data (name, license number of the National Center for Non-Profit Sector,
classification from the initiative document, region, city, contact), fields of work (the
Presidency's available programmes), the officer and the account (username and password chosen by
the applicant), and the values pledge with a summary. Each step shows a Haramain photograph and a
line of the strategy (vision, objectives 5 and 1, the values التعاون and تعظيم الحرمين).
- **Nothing is created before approval.** An application is an `AssociationRegistration` row
  (status PENDING). The super admin reviews it (`registrations.review`, `/admin/registrations`);
  approval creates the association, its officer account and the audit entries in one transaction,
  re-checking that the license, username, email and national ID are still free. Rejection needs a
  reason, which the applicant sees.
- **The password** is hashed with argon2 at submission and stored only as a hash; approval moves the
  hash to the credential account (`createUserWithPasswordHash`, `mustChangePassword` false, as the
  applicant chose it), and any decision clears it from the application. Snapshots in the audit log
  carry an explicit field list (no hash, no national ID).
- **Abuse limits:** five submissions per hour and twenty status lookups per fifteen minutes per
  client (in-memory limiter, same caveat as the other limits), a honeypot field, server-side
  validation of everything (the step checks in the browser are a convenience).
- **Status tracking** (`/register/status`) needs the reference (random, `JM-` and eight characters,
  not sequential) together with the license number; it shows the status, the dates, the reason when
  rejected and the username when approved.
- Entry points: the login page (a gold «جمعية جديدة؟» card and a tracking link), the public header,
  the home hero and closing band, and the footer.
