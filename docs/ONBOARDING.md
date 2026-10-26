# Onboarding

A short path from a fresh clone to a working development setup, and the conventions you need before
changing anything.

## 1. Read first

1. [CLAUDE.md](../CLAUDE.md): working conventions and non-negotiable rules (also used by coding agents).
2. [ROADMAP.md](ROADMAP.md): the phase plan, what is done, and open items before production.
3. [DESIGN.md](DESIGN.md): the binding design system (Arabic, RTL, Cairo, tokens, components).
4. [DECISIONS.md](DECISIONS.md): why things are the way they are (search for a `D-` number).
5. [PERMISSIONS.md](PERMISSIONS.md): generated permission matrix.
6. [ARCHITECTURE.md](ARCHITECTURE.md) and [GLOSSARY.md](GLOSSARY.md).

## 2. Set up

Follow «First run» in the [README](../README.md). Use your own values for every `<placeholder>` in
`.env`; nothing in this repository contains a real password, secret or address.

Useful commands:

| Command | Purpose |
|---|---|
| `npm run db:up` | Start PostgreSQL in Docker (port 5433) |
| `npm run db:deploy` / `npm run db:migrate` | Apply migrations / create a new migration in development |
| `npm run db:generate` | Regenerate the Prisma client (not automatic after migrations in Prisma 7) |
| `npm run db:seed` | Reference data and the first super admin |
| `npm run db:seed:dev-users` | Optional development accounts per role |
| `npm run docs:permissions` | Regenerate `docs/PERMISSIONS.md` after changing the matrix |

## 3. Everyday rules

- Every page, action and route handler authorises on the server (`requireUser()`, `can()`, the
  scopers). Never rely on hidden UI.
- Every mutation is audited with `audit()`, in the same transaction where possible.
- Internal notes never reach association officers; drafts never reach staff.
- Migrations are additive. Show the SQL for review before applying; never reset a shared database.
- UI: Arabic only, logical RTL utilities only, no emoji, design tokens only (`npm run lint` checks).
- No secrets in code, seeds, tests or docs. `.env` stays local.
- Never run raw recursive deletes on copies of the project or on `.next`; use
  `node scripts/safe-remove.mjs --root <scratch folder> <path>` (D-091).
- Definition of done for a change: typecheck, lint, tests and build pass, no console errors.

## 4. Private material

The following are deliberately **not** in this repository (see `.gitignore`):

- the Presidency's source documents: the strategy outline, the initiative document and the
  programmes overview (PDFs), from which the taxonomy and site texts were extracted;
- the colleague's early HTML draft that was used for information architecture ideas only;
- the design-lab route and its notes (three visual directions compared before the design step);
- review screenshots for each phase;
- the design handoff (`design_handoff_rifada_platform`, the approved prototype behind docs/DESIGN.md);
- the official vector logos. The repository ships raster logos in `public/brand/` (committed at the
  owner's request, D-092); replace them through `src/config/brand.ts` when the vectors arrive.

To obtain any of them, ask the project owner through a private channel (for example a private
message to the repository owner on GitHub). Do not commit them to this repository.
