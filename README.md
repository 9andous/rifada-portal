# Rifada (رفادة)

Technical supervision portal for the supervision unit over non-profit organizations serving
visitors of the Two Holy Mosques. Associations submit programmes and projects under the
Presidency's seven programmes; supervisors review them; the unit manager oversees the flow. The
interface is Arabic only, right to left.

> **Proprietary — all rights reserved.** This repository is public for visibility only. No licence
> is granted to use, copy, modify or distribute it. See [LICENSE](LICENSE).

## ملخص بالعربية

«رفادة» منصة إشرافية فنية للوحدة الإشرافية على المنظمات غير الربحية بالحرمين الشريفين: تقدّم
الجمعيات طلبات برامجها ومشروعاتها ضمن البرامج السبعة، ويراجعها المشرفون، ويتابع مدير الوحدة سير
العمل كله. الواجهة عربية بالكامل ومن اليمين إلى اليسار. المستودع منشور للاطلاع فقط، وجميع الحقوق
محفوظة، ولا يمنح أي ترخيص للاستخدام أو النسخ أو التعديل أو التوزيع.

## Status

| Phase | State |
|---|---|
| 1a Foundation, design step, 1b taxonomy | Done |
| 2 Users, associations, settings, audit log, taxonomy editors, statuses, templates | Done (CSV import deferred) |
| 3 Requests core: form, drafts, completeness check, assignment, decisions, comments | Done |
| 4–7 Dashboards and notifications, public site, reports, demo mode | Not started |

Details: [docs/ROADMAP.md](docs/ROADMAP.md) (plan and open items before production),
[docs/DECISIONS.md](docs/DECISIONS.md) (why things are the way they are),
[docs/PERMISSIONS.md](docs/PERMISSIONS.md) (who can do what), [docs/DESIGN.md](docs/DESIGN.md)
(design system), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ONBOARDING.md](docs/ONBOARDING.md),
[docs/GLOSSARY.md](docs/GLOSSARY.md).

## Stack

Next.js 16 (App Router, Cache Components), React 19, TypeScript 6 (strict), PostgreSQL 16 with
Prisma 7, Better Auth 1.7, Tailwind CSS 4, Zod 4, Vitest 5, Docker Compose for the local database.

## Requirements

- Node.js 24.11 or newer, npm
- Docker (for PostgreSQL)

## First run

```bash
cp .env.example .env
```

Fill in every `<placeholder>` in `.env` with your own values: the database user and password
(`POSTGRES_USER`, `POSTGRES_PASSWORD`, and the same values inside `DATABASE_URL` and
`TEST_DATABASE_URL`), a long random `BETTER_AUTH_SECRET`, and `SEED_ADMIN_USERNAME` /
`SEED_ADMIN_PASSWORD` for the first super admin. Never commit `.env`.

```bash
npm ci
npm run db:up        # PostgreSQL in Docker on port 5433 (creates the rifada_test database too)
npm run db:deploy    # apply migrations
npm run db:generate  # generate the Prisma client
npm run db:seed      # reference data and the first super admin from .env
npm run dev          # http://localhost:3000
```

Sign in with the admin username and password you put in `.env`; the account must choose a new
password at first login.

### Optional development accounts

Set `DEV_USERS_PASSWORD` in `.env`, then run `npm run db:seed:dev-users`. This creates
`dev.manager`, `dev.supervisor` and `dev.association` (linked to a development association and to a
fictitious national ID for the mock Nafath sign-in). They are flagged as demo data; remove them and
change every password before any real use.

## Checks

```bash
npm run typecheck
npm run lint        # ESLint plus the UI rules (no emoji, logical RTL utilities only)
npm test            # unit tests, and integration tests against TEST_DATABASE_URL
npm run contrast    # WCAG AA contrast of the design tokens
npm run build
```

The integration tests refuse to run against the development database and truncate the test
database between tests.

## Not in this repository

Source documents (the strategy outline, the initiative document and the programmes overview), the
original design notes and design lab, review screenshots and the official logos (the app ships a neutral placeholder mark) are
private material. See [docs/ONBOARDING.md](docs/ONBOARDING.md#private-material) for how to request them.

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md). Contributions:
[CONTRIBUTING.md](CONTRIBUTING.md).
