> **Where this file conflicts with docs/DECISIONS.md or docs/ROADMAP.md, those win.**
>
> This is the original master brief given at the start of the project. Changes approved since then
> are recorded in docs/ROADMAP.md (approved plan changes) and docs/DECISIONS.md (technical decisions).

# MASTER BRIEF: "Rifada" (رفادة) — Technical Supervision Portal for Charities, Saudi Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque

You are building a real, production-quality full-stack MVP for a Saudi government entity. Treat this as a premium government product, not a demo or a template. Work in PLAN MODE first: read everything, ask me the architecture questions listed in section 12, then propose a phased plan. Do not write code until I approve the plan.

## 1. Context

The Presidency of Religious Affairs at the Grand Mosque and the Prophet's Mosque (رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي) is now officially the technical supervisory body over charitable and volunteer associations serving the pilgrims. Its supervision unit is named "الوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين". This platform is that unit's operating system.

It is separate from "Nawa" (نوى), which only accepts or rejects an entity's registration. This platform covers everything after that: associations submit programs/projects under the Presidency's 7 programs, supervisors review them, and the unit manager oversees the whole flow. The aim is to move supervision off email, paper and instant messages onto one governed, auditable, measurable platform.

Primary audience of the first release: supervisors and the dev team, plus association officers who log in to submit and track their own requests.

## 2. Source material (read ALL before planning)

> In the public repository these files are not included: the three PDFs, the colleague's draft
> and the original logo files are private material (see docs/ONBOARDING.md, «Private material»).

- initiative.pdf (private) — the initiative document (purpose, scope, 4-phase method, deliverables). NOTE: its text layer is broken (Arabic comes out reversed/garbled). Render pages to images and read them visually.
- strategy-outline.pdf (private) — strategy outline: vision, mission, 7 values, 7 strategic objectives, and the 7 programs with their objectives and initiatives (مبادرات). Each initiative table has a matrix linking it to the 7 strategic objectives (checkmark columns 1 to 7).
- programs-overview.pdf (private) — a poster/overview of the programs.
- rifada-portal-draft.html (private) — a rough draft from a colleague. Use it ONLY for information architecture ideas (home, programs, guides/documents, login). Do NOT copy its visual style, its fake numbers, its role-picker, or its "five tracks" (these are replaced by the 7 programs below).
- brand logos (private originals; the app's copies are in public/brand/) — logos. a white version (for dark surfaces), a colour version (for light surfaces) and a white @4x version. Source resolution is low; load the logo from ONE config location so a high-res/SVG can be swapped in later with zero code changes. Never recolor, redraw or alter the logo. In dark mode use the white version.

## 3. Product scope (MVP, locked)

Build a working full-stack system. It starts with an EMPTY operational database (no fake data) plus a switchable DEMO MODE that fills it with realistic fake Arabic records for presentations (section 9).

In scope:
1. Public home page (no login required).
2. Credential login. The account's role decides which dedicated dashboard opens. There is NO role picker and NO "browse without login" link.
3. Four roles with strict visibility (section 5).
4. Associations registry and association accounts.
5. The taxonomy: 7 programs, their initiatives, 7 strategic objectives, and initiative-to-objective links, loaded as editable data extracted from the PDFs.
6. Requests module: association submits a request under a program and initiative, goes through review, with comments and attachments.
7. Automatic completeness check on every submission.
8. Assignment: automatic by program, manual reassignment by the unit manager.
9. Document library: attachments with versions, required attachments per initiative, downloadable templates.
10. Announcements and guides library, managed by admins.
11. In-platform notifications (email/SMS only as stubbed interfaces).
12. Dashboards with real computed numbers per role.
13. Reports with print and PDF export.
14. Admin area for the super admin.
15. Audit log.

Explicitly OUT of scope (do not build, do not stub UI for): registration or licensing of entities (that is Nawa), payments or any financial transactions, budget/cost fields in requests, e-signature, maturity scoring, periodic evaluations, field visits, corrective-action tracking, real Nafath/SSO integration, formal NCA/PDPL compliance work, video uploads, English interface.

## 4. Locked decisions

- Language: Arabic only, full RTL. Use CSS logical properties. All user-facing copy is natural Modern Standard Arabic in a formal government tone. Code, identifiers, comments and docs are in English.
- Dates: show Hijri (Umm al-Qura) as primary with the Gregorian date smaller beside it. Store dates in UTC.
- Numerals: display Arabic-Indic digits (٠١٢٣…). Store normal numbers.
- Stack (default, approved): Next.js (App Router) + TypeScript (strict) + Tailwind CSS + PostgreSQL + Prisma, with Docker Compose for local run. Any deviation must be proposed in the plan.
- Dark mode: keep a light/dark toggle. Light is default.
- Fonts: self-hosted Arabic font (IBM Plex Sans Arabic for UI; Noto Kufi Arabic or similar for headings). No external font CDNs.
- Attachments: PDF, Word, Excel, images; maximum 25 MB per file (admin-configurable); no video.
- SLA target: 7 working days, admin-configurable setting.
- Login: username/password. Also a visible "الدخول عبر النفاذ الوطني الموحد" button that runs a SIMULATED provider behind a clean interface, clearly marked as mock in code, so real Nafath can replace it later.
- Association accounts: exactly one account per association, created by the super admin (single create + CSV bulk import). No public sign-up. Forced password change on first login; forgot-password flow (email sending stubbed behind an interface; in dev, log the reset link).
- Basic security hygiene only (hashed passwords with argon2 or bcrypt, secure httpOnly sessions, CSRF protection, rate-limiting on login, input validation with a shared schema library, authorization checks on the server for every query and mutation). No formal compliance work in this phase.

## 5. Roles and visibility (enforce on the server, with tests)

- Super admin (the dev team): everything, plus system settings and user management.
- Unit manager: sees all requests, associations and programs; assigns/reassigns requests; sees management dashboards and reports.
- Supervisor: sees only requests belonging to the programs assigned to them; reviews, comments, returns, approves or rejects them.
- Association officer: sees only their own association's requests and documents; creates, edits drafts, submits, replies to comments, uploads versions.

A supervisor can own one or more programs; a program can have several supervisors. Write a permission matrix to docs/PERMISSIONS.md and cover it with automated tests (especially cross-association and cross-program access attempts).

## 6. Domain model (propose the final schema in the plan, ask me to confirm)

Entities at minimum: User, Association, Program, Initiative, StrategicObjective, InitiativeObjectiveLink, InitiativeRequirement (required fields and required attachment types per initiative), SupervisorProgram, Request, RequestStatusHistory, Comment, Attachment, AttachmentVersion, Template, Announcement, Guide, Notification, AuditLog, Setting. Demo records carry an isDemo flag.

The 7 programs (from the strategy document; verify names and initiative lists against the PDFs, which are the source of truth):
1. برنامج الأئمة والمؤذنين
2. برنامج الدروس العلمية
3. برنامج إصدارات الحرمين
4. برنامج إجابة السائلين
5. برنامج مقرأة الحرمين والحلقات
6. برنامج الحسبة والتوعية الميدانية
7. برنامج الدورات التدريبية

Initiative counts are roughly 13, 30, 26, 16, 13, 27 to 28, and 18 respectively; extract exactly what the PDFs contain, keep the original numbering, and report any ambiguity to me instead of guessing. Also extract the vision, mission, 7 values and 7 strategic objectives for use on the home page. Provide the extracted data as seed files (JSON) that an admin can edit later in the admin area.

## 7. Request lifecycle

Statuses are admin-configurable data. Default set: مسودة (Draft), مقدّم (Submitted), فحص الاكتمال (Completeness check, automatic), قيد المراجعة (Under review), معاد للتعديل (Returned for amendment), معتمد (Approved), مرفوض (Rejected). Record every transition with actor and timestamp (RequestStatusHistory and AuditLog).

Request form: program, then initiative (filtered by program), then general fields: title, description, target audience, location, start and end dates, plus the initiative's own required fields and attachments. No budget field.

Completeness check: on submit, validate required fields and required attachment types defined for that initiative. If anything is missing, block submission and show a precise Arabic list of what is missing; persist the result. The check must be deterministic and rule-based. Put an AIService interface in place with a mock implementation for a future model, but ship NO external AI calls.

Assignment: on submission, auto-assign to a supervisor of that program (least open workload first; document this rule). The unit manager can reassign at any time, with history.

Comments: threaded conversation per request between association and supervisor/manager, with attachments allowed.

## 8. Screens

Public home page (top navigation bar, not a sidebar): hero with the unit's name and a one-line purpose; vision and mission; the 7 programs as a clean index; a short "how supervision works" section; latest announcements; guides library; login entry; footer. No invented statistics anywhere on the public page.

Logged-in area uses a sidebar layout with role-specific navigation and dashboards:
- Association: my requests, new request, my documents, notifications, my association profile.
- Supervisor: my queue, all requests in my programs, associations I supervise, reports.
- Unit manager: overview dashboard, all requests, assignments, associations, programs and initiatives (read), reports.
- Super admin: users, associations, programs/initiatives/objectives, required fields and attachments per initiative, statuses, templates, announcements, guides, settings (SLA days, file limits), demo mode, audit log.

Dashboards show counters and charts computed from real data: requests by status, by program, by month; average handling time against the SLA; overdue requests; workload per supervisor. Empty data must render as zero or a dash with a well-designed empty state, never fake values. Every list: search, filters, sorting, pagination, CSV export where sensible.

## 9. Demo mode

A seed command and a super-admin toggle that load realistic fake Arabic data (about 12 associations, 40 to 60 requests across all statuses and programs, comments, announcements, guides) flagged isDemo; one click removes only demo data. Real baseline data (programs, initiatives, objectives, statuses, roles, the first super admin) always loads. Provide demo accounts for each role in README.

## 10. Reports (print + PDF)

Four reports: single request summary; program report (requests by status and initiative); association report (request history); unit-manager overview. Requirements: correct RTL Arabic with embedded fonts, the Presidency logo in the header, Hijri and Gregorian date, page numbers, a print stylesheet, and downloadable PDF. Propose the PDF approach in the plan (server-side browser rendering is my expectation for Arabic quality).

## 11. Design direction — premium government, zero AI slop

- Visual identity from the Presidency: deep green and gold. Sample the exact tones from the brand logos and the PDFs, define them as design tokens (light and dark), and use gold sparingly as an accent.
- Calm, authoritative, dense where data lives. Prefer well-designed tables, split panes, timelines, and structured detail pages over grids of identical cards. Do NOT build generic card grids, gradient blobs, glassmorphism, emoji, or decorative stock imagery.
- NO emoji anywhere in the UI. Use one consistent line-icon set (e.g., Lucide) at consistent sizes. A restrained Islamic geometric pattern may be used subtly (hero background, empty states, report headers), drawn as SVG, never busy.
- A real type scale, spacing system and elevation system defined once as tokens. Strong hierarchy, generous whitespace on the public pages, tighter density in dashboards.
- Every screen must have designed loading, empty, error and permission-denied states.
- Desktop-first, usable at tablet width. WCAG AA contrast, visible focus states, keyboard navigation, correct lang/dir attributes.
- Natural Arabic microcopy; never machine-sounding. If you are unsure about phrasing, list it for my review.

## 12. Ask me BEFORE deciding (use the question tool, one batch, with your recommendation for each)

1. Database schema confirmation (section 6).
2. Authentication/session approach (library vs custom).
3. File storage approach (local disk behind a storage interface vs S3-compatible, e.g., MinIO in Compose).
4. PDF generation approach.
5. Project structure and any deviation from the approved stack.
6. Deployment target assumptions for Docker.
Small decisions (naming, folder layout, minor libraries): decide yourself and log them in docs/DECISIONS.md.

## 13. Working method

- First action: create CLAUDE.md describing conventions (stack, commands, RTL rules, no-emoji rule, permission rules, testing rules, Arabic copy rules) and keep it current.
- Build in the phases below. STOP after each phase, summarize what was done, how to run and verify it, and wait for my go-ahead.
- Phase 1, Foundation: project setup, Docker Compose, Prisma schema and migrations, design tokens and base component library (RTL, light/dark), fonts, logo, Hijri/Arabic-numeral utilities, auth with the four roles, route protection, audit logging, seed of the taxonomy from the PDFs. Acceptance: I can log in as each role and land on its own empty dashboard; unauthorized routes are blocked; taxonomy is visible in admin; typecheck and lint pass.
- Phase 2, Admin and reference data: users, associations (single + CSV import), programs, initiatives, objectives, per-initiative required fields and attachments, statuses, settings, templates. Acceptance: everything editable; changes are audited.
- Phase 3, Requests core: form, drafts, submission, completeness check, assignment (auto + manual), statuses, comments, attachments with versions. Acceptance: full lifecycle works end to end; permission tests pass, including cross-association and cross-program denial.
- Phase 4, Dashboards and notifications: computed metrics per role, in-app notifications, SLA and overdue logic. Acceptance: zero-data states are correct; numbers match the database.
- Phase 5, Public home page, announcements and guides. Acceptance: matches section 8 and 11 with no invented figures.
- Phase 6, Reports and print/PDF. Acceptance: four reports render correct Arabic RTL in print and PDF.
- Phase 7, Demo mode, hardening and docs: seed/wipe demo data, error handling, accessibility pass, README, PERMISSIONS.md, DECISIONS.md, test run. Acceptance: demo toggle works both ways; a fresh clone runs with documented commands.

## 14. Definition of done for every phase

TypeScript strict with no errors, lint clean, meaningful tests for permissions and the completeness check, no hard-coded or fake figures outside demo mode, no lorem ipsum, no emoji in UI, all strings in Arabic, no console errors, and screenshots or clear run steps for me to review.

Start now in plan mode: read ./docs/, then ask the section 12 questions, then present the phased plan for my approval.
