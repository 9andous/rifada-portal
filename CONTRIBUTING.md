# Contributing

This is proprietary software, public for visibility only (see [LICENSE](LICENSE)). Contributions
are accepted only from people invited by the project owner; unsolicited pull requests will be
closed. Security issues: see [SECURITY.md](SECURITY.md), never a public issue.

## Working method

- Work follows the phases in [docs/ROADMAP.md](docs/ROADMAP.md). A phase starts only after the
  owner approves it and ends with a review stop.
- Read [CLAUDE.md](CLAUDE.md), [docs/DESIGN.md](docs/DESIGN.md) and the relevant entries in
  [docs/DECISIONS.md](docs/DECISIONS.md) before changing anything. Record new decisions there.
- Wording that needs a native Arabic review goes into [docs/COPY-REVIEW.md](docs/COPY-REVIEW.md).

## Code rules

- Authorisation on the server for every page, action and route handler; scoped reads through the
  query scopers; a permission test for every new action, including cross-association and
  cross-programme denial.
- Every mutation audited; audit rows are append-only.
- Migrations are additive; never reset a shared database.
- UI: Arabic only, RTL logical utilities only, no emoji, design tokens only, every screen with
  loading, empty, error and permission-denied states.
- Code, identifiers, comments and documentation in English; interface text in formal Arabic.
- No secrets or personal data in code, seeds, tests, docs or commit messages.
- Never run raw recursive deletes on copies of the project; use `scripts/safe-remove.mjs`.

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run contrast   # after any token change
npm run build
```

Keep commits focused and messages descriptive. Do not commit `.env`, `storage/`, `.next/`,
screenshots or any file listed in `.gitignore`.
