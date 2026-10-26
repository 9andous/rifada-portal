# Rifada (رفادة) — working conventions

Technical supervision portal for the Presidency of Religious Affairs' supervision unit over
non-profit associations serving pilgrims. Arabic-only, RTL, government product. Read
`docs/DECISIONS.md` for why things are the way they are, and `docs/PERMISSIONS.md` for who can do what.

This public repository leaves out private material: the Presidency's source PDFs, the early HTML
draft, the design lab (`src/app/dev/design-lab`, `docs/design-lab.md`), the design handoff and
review screenshots. References to them in the docs are historical; obtain them privately as described
in `docs/ONBOARDING.md` and never commit them (they are in `.gitignore`). The Rifada and Presidency
logos (`public/brand/`) and the Haramain photographs (`public/images/haramain/`) are committed at the
owner's request (D-092).

@AGENTS.md

## Session rules

At the start of every session read CLAUDE.md, docs/ROADMAP.md, docs/DESIGN.md, docs/DECISIONS.md and docs/BRIEF.md. Work in the phases of docs/ROADMAP.md, stop after each phase for my approval, and update the status table in docs/ROADMAP.md when a phase is accepted. Never start a phase I have not approved.

## Stack (pinned; see DECISIONS.md D-001)

- Next.js 16.4 App Router, React 19, **Cache Components + Partial Prefetching on**.
  Request-time reads (`headers()`, `cookies()`, session) must sit under a `<Suspense>` boundary.
  Next.js 16 conventions apply: `src/proxy.ts` (not `middleware.ts`), typed `PageProps`/`LayoutProps`.
  The bundled docs in `node_modules/next/dist/docs/` are authoritative for this version.
- TypeScript 6.0 strict (TypeScript 7 is not used: typescript-eslint needs the JS compiler API).
- Prisma 7.10 (stable; 8.x is RC) with `@prisma/adapter-pg`. Client is generated to
  `src/generated/prisma` (git-ignored). Import from `@/generated/prisma/client`.
  `prisma migrate dev` does **not** regenerate the client in v7: run `npm run db:generate`.
- Better Auth 1.7 (username plugin, argon2id via `@node-rs/argon2`, DB sessions, rate limiting).
- Tailwind CSS 4.3, CSS-first config in `src/app/globals.css`; tokens in `src/styles/tokens.css`.
- Radix primitives via the `radix-ui` package, Lucide icons, Zod 4, Vitest 5, Playwright.
- npm (not pnpm: pnpm is not installed on the dev machine; D-002).

## Commands

```
npm run db:up               # start Postgres (docker compose, port 5433; credentials from .env)
npm run db:migrate          # create/apply migrations (dev); then npm run db:generate
npm run db:seed             # baseline reference data + first super admin from .env
npm run db:seed:dev-users   # optional dev accounts per role (flagged isDemo)
npm run dev                 # http://localhost:3000
npm run typecheck           # next typegen + tsc
npm run lint                # eslint + scripts/check-ui-rules.mjs (emoji, RTL utilities)
npm test                    # vitest: unit + integration against rifada_test database
npm run contrast            # WCAG AA check of design tokens
npm run docs:permissions    # regenerate docs/PERMISSIONS.md after changing the matrix
npm run build
```

## Layout

- `src/app/(public)` public pages with top navigation; `(auth)` login and password pages (split
  layout); `(account)` signed-in pages outside a role
  area (403); `(app)/<area>` role areas with the green-band shell.
- `src/server/` server-only code: `auth/` (Better Auth config, session helpers, user creation),
  `authz/` (roles, permission matrix, query scopers), `services/` (audit, email, rate limit),
  `identity/` (national-ID sign-in interface + MOCK Nafath plugin), `storage/` (`StorageService`,
  local disk under `STORAGE_DIR`, opaque keys), `uploads/` (staging pipeline: limits, type and
  magic-byte checks, owner/single-use/one-hour), `actions/` (server actions;
  `actions/admin` are thin wrappers over `services/admin`, which take an `Actor` and check `can()`;
  `actions/requests.ts` wraps `services/requests/*`: drafts, submission and completeness, assignment,
  decisions, files, comments, read loaders; `services/notifications.ts` writes Notification rows).
- `src/components/ui` primitives (incl. `ListToolbar`, `SortHeader`, `Pagination`, `DataTable`,
  `ConfirmDialog`, `FormDialog`, `TabNav`, `OneTimeSecret`, `Avatar`, `HijriDateInput`), `requests` the shared
  request list (`RequestListPage`, server-rendered `RequestsTable` with client islands in
  `request-selection.tsx`), request page (`RequestView`), form and dialogs, `admin` admin forms and panels,
  `taxonomy` taxonomy and requirements editors (admin) and read-only views (manager), `layout` shells, `states`
  empty/error/forbidden/skeletons, `brand` logo/pattern.
- `src/lib` isomorphic helpers (format, validation schemas, cn).
- `prisma/seed/*.json` editable seed data; `prisma/seed/index.ts` baseline seed (idempotent).

## Non-negotiable rules

- **Authorization on the server, every time.** Pages, server actions and route handlers call
  `requireUser()`/`requireRole()` and check `can()`. Scoped reads go through `scopeRequests`,
  `scopeAssociations`, `scopeComments`. Never rely on hidden UI. Every new action gets a permission
  test, including cross-association and cross-program denial.
- **Internal notes never reach association officers** through any route, list, export, print or PDF.
- **Audit** every mutation with `audit()` (same transaction where possible). Audit rows are append-only.
- **No fake figures** outside demo mode. Empty data renders as ٠ or — with a designed empty state.
- **Secrets only from `.env`.** No passwords or keys in code, seeds or committed files.
- **No raw recursive deletes on copies of the project** (worktrees, scratch copies, build output).
  They contain links and junctions into the real `node_modules` (`.next/node_modules/*`, a
  junctioned `node_modules`), and `rm -rf`, `Remove-Item -Recurse` or `git worktree remove` can
  follow them. Use `node scripts/safe-remove.mjs --root <scratch folder> <path>`, which unlinks every
  link first and refuses paths outside the scratch folder, the project itself and real
  `node_modules` folders. Never delete `node_modules` through a copy, and never delete this
  project's `.next` recursively (D-091).

## UI rules

**`docs/DESIGN.md` is the design system and is binding for every screen, including Phase 3's
requests list, detail page, bulk actions and decision panel.** Read it before any UI work. In short:

- Arabic only, `<html lang="ar" dir="rtl">`. Use logical utilities only (`ms-/me-/ps-/pe-`,
  `start-/end-`, `text-start/end`, `border-s/e`). Physical ones fail `npm run lint`.
- Cairo everywhere (`src/app/fonts.ts`); typographic roles `t-page`, `t-section`, `t-label`,
  `t-body`, `t-figure`, `t-table`, `t-caption`.
- Handoff radii (buttons and inputs 10, cards 14, hero panels 20). No dashed borders.
- Shell: gov banner, white header with both logos, green navigation bar, white page head
  (`<PageBand>`) with key figures as cards below it, then cards on the canvas.
- **No emoji anywhere.** Icons: Lucide only, `size-4` inline / `size-[18px]` nav / `size-5` states.
- Colors only through semantic tokens (`bg-surface`, `text-ink-muted`, `bg-primary`, `bg-band`,
  `text-band-ink`, `text-st-ok`, `bg-chart-3`, ...). Gold (`accent`) is for rules and marks; gold
  text only via `accent-ink` or `band-gold`. Run `npm run contrast` after any token change.
- Status is a dot plus text (`<StatusText>`); notices are `<Alert>` (soft tint, 4px side rule).
- Numbers through `formatNumber`/`toArabicDigits`; references through `<RefNumber>`; dates through
  `<DateDisplay>` (Hijri first, Gregorian smaller, Asia/Riyadh time zone). Store numbers plainly and
  dates in UTC.
- Prefer structured tables, split panes and timelines over grids of identical cards.
- Every screen needs loading, empty, error and permission-denied states.
- Pass icons to client components by name, not as components (RSC serialization).

## Arabic copy

Formal Modern Standard Arabic, government tone, short and direct. Address association users in the
plural of respect where natural («قدّمتم»), staff in the singular. Wording that needs a native
review goes into `docs/COPY-REVIEW.md`. Code, identifiers, comments and docs are in English.

## Testing

- Unit tests in `tests/unit`, integration tests in `tests/integration` against `TEST_DATABASE_URL`
  (the suite refuses to run against the dev database and truncates tables between tests).
- Auth tests call `auth.handler` with real HTTP requests; give each test its own `x-forwarded-for`
  so the rate limiter does not leak between tests.
- Definition of done per phase: typecheck, lint, tests, build all pass; no console errors;
  screenshots or run steps for review.
