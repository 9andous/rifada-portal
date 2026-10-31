# Roadmap

The approved build plan for Rifada. This file and `docs/DECISIONS.md` take precedence over
`docs/BRIEF.md` (the original brief) wherever they differ.

**Rules for every session:** work only in the phase that is currently approved, stop at the end of
each phase for the owner's review, and update the status table below when a phase is accepted.
Never start a phase that has not been approved.

## Status

| Step | Status | Notes |
|---|---|---|
| Phase 1a — Foundation | **Done** — functionality accepted | Visual design of the real screens rejected; replaced by the design step below. |
| Design step | **Done** — direction C with elements of A, applied to the app shell, login and the four dashboards (stops 1 and 2 accepted) | Decisions in `docs/DESIGN.md`. The design lab is private material (not in this repository). |
| Phase 1b — Taxonomy extraction | **Done**: verified by the owner against the strategy outline (private PDF) on 2026-10-24 | 143 initiatives (13/30/26/16/13/27/18), 670 links, 0 uncertain cells; review at `/admin/taxonomy/review`. Decisions D-027 to D-033. |
| Phase 2a stop 1 — Users, associations, settings, audit log | **Done**: verified by the owner on 2026-10-24 | Review changes applied: optional contact email and phone, «إنشاء حساب مسؤول» on the association page. Decisions D-034 to D-046; review screenshots kept privately. |
| Phase 2a stop 2 — CSV import of associations | **Deferred** until the owner has the real list of associations | Approach approved in D-036; not started. |
| Phase 2b stop 1 — Taxonomy and requirements editors | **Done**: verified by the owner on 2026-10-24 | Decisions D-047 to D-058; review screenshots kept privately. |
| Phase 2b stop 2 — Statuses, transitions and templates | **Done**: verified by the owner on 2026-10-24 | Review changes applied: file-type lists isolate Latin names (no stray «و»), a replacement identical to the current version is refused, «نموذج جديد» in the empty templates list. Decisions D-059 to D-069; review screenshots kept privately. |
| **Phase 2 overall** | **Complete**, except the deferred CSV import (2a stop 2) | |
| Phase 3 — Requests core | **Done**: verified by the owner on 2026-10-25 | Merged from `phase-3` with its milestone commits. Decisions D-070 to D-091; review screenshots kept privately. The intermittent hydration error (D-090) stays under «Open items before production». |
| Phase 4 — Dashboards and notifications | **In progress**: the three role dashboards redrawn after the handoff on 2026-10-27 (D-097); the association area rebuilt for older users on 2026-10-28 (D-102), awaiting the owner's review | Notifications, CSV export, working-day average not started. |
| Phase 5 — Public site, announcements, guides | **In progress**: home page built on 2026-10-25 with the design handoff v2 (D-092), awaiting the owner's review | Announcements, guides and programme pages not started. |
| Review workflow change, phase 1 — «الأدلة والنماذج» | **Done**: accepted by the owner on 2026-10-29 | Guides and forms, filters, sample data (D-113); association prints only approved requests (D-114). |
| Review workflow change, phase 2 — Several initiatives per request, the association's own files | **Done**: accepted by the owner on 2026-10-29 | D-115. |
| Review workflow change, phase 3 — Supervisor evaluation, signature, unit manager approval | **Built** on 2026-10-29; signatures revised on 2026-10-30 (electronic seals and QR verification instead of drawn signatures), awaiting the owner's review | D-116, D-117, D-120, D-122. |
| Review workflow change, phase 4 — «المسارات» above the programmes | **Built** on 2026-10-30, awaiting the owner's review | D-119. |
| Phase 6 — Reports, print and PDF | Not started | |
| Phase 7 — Demo mode, hardening, docs | Not started | |

## Architecture answers (approved before the plan)

| Question (brief §12) | Approved answer |
|---|---|
| Authentication and sessions | Better Auth (username plugin, DB sessions, argon2id, rate limiting). |
| File storage | Local disk (Docker volume) behind a `StorageService` interface; files served only through authorized route handlers. |
| PDF generation | Server-side Playwright Chromium rendering of dedicated print routes. |
| Deployment target | Local development only for now (`docker compose`); production hosting decided later. |
| Stack | Next.js App Router, TypeScript strict, Tailwind CSS, PostgreSQL, Prisma, Docker Compose; versions in DECISIONS.md D-001. |
| Database schema | Approved with the changes listed below (see `prisma/schema.prisma`). |

## Approved changes to the plan

1. **Phase 1 split into 1a and 1b.** 1a is the foundation; 1b is the taxonomy extraction with a local
   review page listing all 143 initiatives and their objective links, for verification against the
   PDF before continuing. Stop after 1a and after 1b.
2. **Taxonomy ambiguity defaults accepted** (all six):
   - Program 6 display name «برنامج الحسبة والتوعية الميدانية»; the PDF's long form «برنامج هيئة الأمر بالمعروف والنهي عن المنكر (الحسبة والتوعية الميدانية)» stored as `officialName`.
   - Program 6 numbering skips 25: keep original numbers 1–24 and 26–28 (27 initiatives), noted in the seed file.
   - Program 1 initiative 2 spans two rows (app and VR app): one initiative «تطبيق الحرمين الشريفين (ويشمل نسخة الواقع الافتراضي VR)».
   - Initiatives with the same name under two programs («تبيان ودلالة»; «منتخبات موشن جرافيكس من فتاوى إجابة السائلين») are separate records per program.
   - Obvious spacing typos in the source are fixed and each change is listed in DECISIONS.md.
   - Each table is read twice; uncertain checkmark cells are listed for the owner, never guessed.
3. **npm instead of pnpm** (pnpm is not installed on the development machine).
4. **Current stable versions checked before scaffolding** (Next.js, Better Auth, Prisma, Tailwind),
   following their current conventions (e.g. `proxy.ts` instead of `middleware.ts`).
5. **CSV import of association accounts:** generated passwords are shown once on screen with one
   optional download of that same result; never stored, never logged in plaintext, never written to
   disk on the server; accounts keep `mustChangePassword` on.
6. **`git init` and `.gitignore`** in Phase 1a (env files, uploaded files, database volume,
   `node_modules`, build output).
7. **First super admin's password comes from `.env` only.**
8. **Demo account passwords exist only in demo mode** and are removed with demo data; the README
   warns to change or remove them before any real use.
9. **Public program pages** show only program names, goals, vision, mission, values and objectives.
   Initiative lists appear only after login, behind one settings flag (`public.showInitiatives`,
   default off) that can later make them public. Enforced in the data loader and tested.
10. **Association `licenseNumber`, `classification` and `region` are optional.**
11. **Reference numbers use the current Hijri year**, computed at submission (`RF-<hijriYear>-<seq>`),
    never hard-coded.
12. **`nationalId` is optional and used only by the mock Nafath provider**; never required on any
    account, including association accounts.
13. **Internal comments are covered by permission tests** proving an association officer can never
    read them through any route, list, export, print view or PDF.
14. **Visual foundation:** the font is Cairo; corners are sharp (2px); the light theme is warm ivory;
    the dark theme is the layered green-black of direction C; the geometric pattern stays on the
    login panel, on green bands, and later on the home hero.
15. **Green header band:** it holds navigation, page title and key figures and fades softly into the
    ivory page; nothing overlaps it.
16. **Phase 3 requests list and detail follow `docs/DESIGN.md`:**
    - big status numbers act as filters; status is shown as a dot plus text;
    - per-row approve, return and reject icons appear on hover (always visible on touch) for requests
      under review, only for the responsible supervisor and the unit manager;
    - every action opens a centred confirmation modal with the request title and reference, a
      required reason for return and reject, and cancel/confirm;
    - bulk actions use a checkbox column and a selection bar (approve, return, reject, and reassign
      for the unit manager only) with one shared reason, a status-history and audit entry per
      request, only in-review requests inside the user's scope, a partial-failure summary, and a
      maximum of 25 requests per action;
    - the request detail page has a sticky «القرار» side panel (a fixed bottom bar at tablet width)
      and no repeated button row;
    - no vertical divider and no horizontal section separators;
    - a flat conversation thread, with internal notes marked by a gold side rule.
17. **Phase 2 settings include the bulk action maximum** (default 25).
18. **Phase 3 acceptance adds permission tests for bulk actions:** an out-of-scope or non-review
    request in a bulk selection is rejected server-side and reported as skipped, and each affected
    request has its own status-history and audit entry.
19. **Drafts are private:** draft requests are private to their association. Supervisors, the unit
    manager and the super admin must not be able to read, list, count, export, print or download a
    draft (or its attachments or comments) through any route. Staff see a request only once it has
    been submitted. Tests prove this for every role and every read path.
20. **Phase 2 split into 2a and 2b** (approved 2026-10-24). 2a = users, associations, CSV import,
    settings and the audit-log viewer, delivered in two stops (stop 2 is the CSV import only);
    2b = editors for programs, goals, initiatives, objectives and links, per-initiative required
    fields and attachment types, statuses and transitions, templates.
21. **Phase 2b in two stops** (approved 2026-10-24). Stop 1: taxonomy and requirements editors;
    stop 2: statuses, transitions and templates, started only when the owner says so. Answers for
    stop 1: one additive migration (`sourceNote` on programs, goals and objectives; `archivedAt` on
    goals), requirement copy replaces all, up/down reordering, «موقوف» and «مؤرشف» as two states,
    requirement and attachment-type keys immutable, objectives edited (title, description) but never
    archived, and archiving or pausing a program hides its initiatives as a derived effect.

## Phases

Every phase must meet the definition of done: TypeScript strict with no errors, lint clean,
meaningful tests (permissions, completeness check), no fake figures outside demo mode, no lorem
ipsum, no emoji, all UI strings in Arabic, no console errors, and screenshots or run steps for review.

### Phase 1a — Foundation (done)
**Scope:** version check and DECISIONS.md; CLAUDE.md; git init and `.gitignore`; Next.js scaffold;
Docker Compose (Postgres); Prisma schema and migrations; design tokens, self-hosted fonts, logo
config, base UI kit, light/dark toggle; Hijri and Arabic-numeral utilities; Better Auth
(username/password, argon2id, forced first-login password change, forgot/reset with the link logged
in development, rate limiting); mock Nafath sign-in; role routing in `proxy.ts`; authorization
skeleton (permission matrix, query scopers); audit log service; baseline seed (statuses, strategic
objectives, values, vision and mission, settings, first super admin from `.env`); an empty dashboard
per role.
**Acceptance:** log in as each role and land on its own empty dashboard; other roles' areas are
blocked (HTTP 403); typecheck, lint and auth tests pass.

### Phase 1b — Taxonomy extraction
**Scope:** read the 11 initiative table images (each twice) and write `prisma/seed/taxonomy.json`
(7 programs with goals, 143 initiatives with original numbering, initiative-to-objective links)
applying the accepted defaults; seed it; read-only taxonomy view in admin; a local review page
(`/admin/taxonomy/review`, super admin only, printable) listing every initiative per program with
number, name, a 7-column objective grid mirroring the PDF and the source page number, with uncertain
cells highlighted and listed.
**Acceptance:** counts 13 / 30 / 26 / 16 / 13 / 27 / 18 = 143; the owner verifies the review page
against the PDF before Phase 2.

### Phase 2a — Users, associations, settings, audit log (change 20)
Two stops, each followed by the owner's review.

**Stop 1 scope:** users (super admin only: list, create, edit, deactivate/reactivate, reset
password; username, full name, optional email and phone, role; supervisors assigned to one or more
of the 7 programs; a temporary password shown once on screen with one copy button, never stored in
plaintext or logged, `mustChangePassword` on); rules: no self-deactivation or self-demotion, the
last active super admin cannot be removed, deactivation revokes sessions, an association officer is
linked to exactly one association and an association has exactly one officer account.
Associations (super admin creates, edits and deactivates, optionally creating the officer account
in the same step; the unit manager has a read-only list and detail page). Settings (SLA working
days, maximum upload size, allowed attachment types, bulk action maximum, `public.showInitiatives`),
validated and audited with before and after. Audit log viewer (super admin, read-only, filters by
actor, action, entity and date range, Hijri and Gregorian dates). Navigation items for these screens
activated for the correct roles only. Every list has search, filters, sorting and pagination; every
screen has loading, empty, error and forbidden states.
**Stop 2 scope (deferred until the owner has the real list of associations):** CSV import of
associations: downloadable template; UTF-8 with or without BOM; comma or semicolon delimiter
detected from the header row; preview with a per-row report (valid, error with Arabic reason,
duplicate) before anything is written; only valid rows imported after confirmation; generated
usernames (short random id) when the officer username is blank; generated passwords shown once with
one optional download, never stored, logged or written to the server's disk; maximum rows
configurable; a clear message when a commit succeeded but its response was lost.
**Acceptance:** permission tests for each role on every route and server action (including an
officer or supervisor trying to read users or settings); last-super-admin, self-deactivation and
one-account-per-association rules; audit entries without secrets; settings validation (stop 2: CSV
validation cases). Typecheck, lint, tests, contrast and build pass; screenshots (kept privately); records created for screenshots are removed at the end of each stop.

### Phase 2b — Reference data editors (change 21)
Two stops, each followed by the owner's review. Super admin only for all editors; the unit manager
gets read-only views where it makes sense. Every mutation is audited without secrets.

**Stop 1 scope (taxonomy and requirements):** editors for programs (name, official name,
description, order, active), program goals, initiatives (name, number unique per program,
description, source note, active), strategic objectives (title and description only) and
initiative-to-objective links (a 7-checkbox editor per initiative plus a matrix view per program).
Nothing referenced by other records is hard-deleted: archive or deactivate, clearly marked; archiving
or pausing a program hides its initiatives as a derived effect. Editing a name keeps the original
wording in the source note. A way to fix the 10 wording slips of `docs/COPY-REVIEW.md` through the
editor (the slips are not changed automatically). Attachment types (key, Arabic name, allowed groups
pdf/word/excel/image, never video) with seeded defaults. Per-initiative requirements: fields (key,
label, type text/textarea/number/date/select, options, required, order) and attachments (type,
required, order), reorderable, with «نسخ المتطلبات إلى مبادرات أخرى» (preview and confirmation). The
general request fields are fixed and not part of this editor.
**Stop 2 scope (statuses and templates):** the seven system statuses only (no new statuses), renamed,
recoloured and reordered; keys and the terminal flag never change and no status is ever deleted. A
transition editor (from, to, allowed roles, or automatic: performed only by the system, never by a
user) validating that nothing leaves a terminal status, every non-terminal status can reach a
terminal one and no transition is duplicated; default lifecycle seeded if missing; a read-only
lifecycle diagram. Templates (title, description, optional program, initiative and attachment type,
published or not, archived instead of deleted) with file history: uploads streamed through a route
handler into the `StorageService` on local disk (staged uploads owned by their uploader, single use,
one hour; random opaque names; pdf, docx, xlsx, png, jpg/jpeg and webp only, checked by extension,
MIME type and magic bytes; size limit from the settings; SHA-256 stored), downloads only through an
authorized route as attachments; published templates for every signed-in user, unpublished and
archived ones for the super admin only. Placement: super admin «النماذج» under «البرامج والمبادرات»
and «حالات الطلبات» under «الإعدادات»; unit manager read-only «النماذج» and «دورة حياة الطلب» under its
«البرامج والمبادرات»; officer «المستندات»; supervisor «النماذج».
**Acceptance (each stop):** permission tests for every role on every route and server action;
uniqueness and archive rules; audited edits; requirement validation and the copy action (stop 1);
transition validation and file checks (stop 2); nothing hard-deletes referenced records. Typecheck,
lint, tests, contrast and build pass; screenshots (kept privately); the development database is left clean.

### Phase 3 — Requests core
**Scope:** request form (program, then initiative filtered by program, then general and
initiative-specific fields; no budget field); drafts; attachments with versions; submission with the
deterministic completeness check (blocks with a precise Arabic list, result persisted; `AIService`
interface with a mock only); reference numbers per change 11; automatic assignment (least open
workload) and manual reassignment by the unit manager with history; review actions (return, approve,
reject), per row and in bulk, as specified in change 16; comments with attachments and internal
notes; status timeline. Screens follow `docs/DESIGN.md`. A submitted request is never re-checked
when requirements change later; drafts are checked against the requirements as they stand at
submission; request values are stored by requirement key and survive removal of the requirement.
Association uploads reuse the stop 2 upload pipeline (staging, validation, opaque storage, authorized
download). Phase 3 must also settle with the owner: virus scanning requirement from the Presidency's
IT, and per-association storage limits.
An attachment requirement is satisfied when at least one file is attached; several files may be
attached to the same requirement, each with its own version history.
**Settled with the owner (2026-10-25):** association and comment files are uploaded through a
per-request route (`POST /api/requests/[id]/uploads`) into the stop 2 staging pipeline and committed
by a server action; virus scanning is an interface with a no-op implementation until the
Presidency's IT decides the scanner (files are **not** scanned today); a per-association storage
quota is a setting (`uploads.associationQuotaMb`, placeholder default 2 GB). Only the assigned
supervisor and the unit manager decide; the super admin reads submitted requests read-only and each
of its views and downloads is audited; drafts that were never submitted can be deleted by their
association. One additive migration: `requests.requirementsSnapshot` (JSONB, nullable).
**Acceptance:** full lifecycle works end to end; permission tests pass, including cross-association
and cross-program denial, the internal-comment tests of change 13 and the bulk-action tests of
change 18; completeness and assignment tests pass. Draft requests are private to their
association: supervisors, the unit manager and the super admin must not be able to read, list,
count, export, print or download a draft (or its attachments or comments) through any route; staff
see a request only once it has been submitted; tests prove this for every role and every read path
(change 19).

#### Phase 3 milestones (resume point for a new session)

Plan: each milestone ends with typecheck, lint and tests passing and one local commit on `phase-3`.

| Milestone | Status |
|---|---|
| M0 — Branch, roadmap and decisions | Done |
| M1 — Migration, draft-private scopes, storage area, scanner interface, quota setting, working days | Done |
| M2 — Request services (drafts, completeness, submission, references, assignment, decisions, attachments, comments, notifications, loaders) with integration tests | Done |
| M3 — Upload and download routes, server actions | Done |
| M4 — Officer screens (طلباتي، طلب جديد، edit form, request page) | Done (visual check in M7) |
| M5 — Staff screens (lists, request page with «القرار», bulk actions, «الإسناد», admin read-only list) | Done |
| M6 — Remaining permission, draft-privacy and internal-note tests | Done |
| M7 — Full checks, screenshots on a temporary database, cleanup, handover | Done |

### Phase 4 — Dashboards and notifications
**Scope:** computed metrics per role (requests by status, program and month; average handling time
against the SLA; overdue; supervisor workload); in-app notification centre and bell (email/SMS as
stubs); SLA and overdue computation in working days; search, filters, sorting, pagination and CSV
export on lists. Average handling time currently uses calendar days; switch it to working days
together with the SLA logic.
**Acceptance:** zero-data states are correct; integration tests assert the numbers equal direct
database counts.

### Phase 5 — Public site, announcements and guides
**Scope:** public home page (hero, vision and mission, values, 7 objectives, programs index and
program pages per change 9, how supervision works, latest announcements, guides library, login
entry, footer); admin management and public pages for announcements and guides.
**Acceptance:** matches brief sections 8 and 11; no invented figures; initiative visibility follows
the settings flag.

### Phase 6 — Reports, print and PDF
**Scope:** four reports (single request summary; program report; association report; unit-manager
overview) as print routes with a print stylesheet and a Playwright PDF endpoint; Presidency logo in
the header, Hijri and Gregorian date, page numbers, embedded fonts. Test static Cairo font files
for PDF rendering, because the variable Cairo font was embedded as unnamed Type 3 outlines and text
must stay selectable in PDFs.
**Acceptance:** all four reports render correct Arabic RTL in browser print and in the downloaded
PDF; internal notes never appear in reports available to association officers.

### Phase 7 — Demo mode, hardening and docs
**Scope:** demo seeder (about 12 associations, 40–60 requests across all statuses and programs,
comments, small generated attachments, announcements, guides, demo accounts per role per change 8);
super-admin toggle to load and wipe demo data (removes only `isDemo` records); error handling;
accessibility pass (axe in end-to-end tests); README, PERMISSIONS.md, DECISIONS.md; full test run.
**Acceptance:** demo toggle works both ways; a fresh clone runs with the documented commands.

## Open items before production

Kept current by every phase. None of these blocks development; all must be settled before real use.

| Item | Current state |
|---|---|
| Virus scanning of uploaded files | `MalwareScanner` interface with a **no-op** implementation: files are not scanned. The Presidency's IT must choose the scanner (e.g. ClamAV or their gateway). |
| Association storage quota | `uploads.associationQuotaMb` defaults to 2 GB as a placeholder; the real number is to be agreed. |
| Email and SMS delivery | Stub interfaces only (the development email service logs to the console). |
| Nafath sign-in | Mock provider only (D-004); real integration needed. |
| Production hosting | Not decided; local `docker compose` only. |
| Security review | The Presidency's IT security review has not taken place. |
| Templates | Real templates from the Presidency have not been uploaded. |
| Initiative wording | The ten wording slips in initiative names (`docs/COPY-REVIEW.md`) await the owner's correction. |
| Attachment types | The five seeded attachment-type names are placeholders (`docs/COPY-REVIEW.md`). |
| CSV import of associations | Deferred (Phase 2a stop 2) until the real list exists. |
| Intermittent hydration error | Production builds log React #418 on roughly 1 in 10 loads of some pages (also seen on `main`); not reproducible in development; see D-090. |
| Creating associations after handover | Who creates associations and their accounts once the system is handed over is not decided. |

## Out of scope (do not build, do not stub UI for)

- Registration or licensing of entities (that is Nawa)
- Payments or any financial transactions
- Budget or cost fields in requests
- E-signature
- Maturity scoring
- Periodic evaluations
- Field visits
- Corrective-action tracking
- Real Nafath or SSO integration (a clearly marked mock only)
- Formal NCA/PDPL compliance work
- Video uploads
- English interface
