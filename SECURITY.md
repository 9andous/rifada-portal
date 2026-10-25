# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities **privately**. Do not open a public issue, pull request or
discussion, and do not include exploit details in any public place.

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose
**Report a vulnerability**. If that option is not available, send a private message to the
repository owner on GitHub asking for a private channel, without technical details in the first
message.

Please include the affected area (route, action or file), steps to reproduce, the impact you
expect, and any suggested fix. You will receive an acknowledgement, and fixes are coordinated
privately before any disclosure.

## Scope notes

- The project is in development; production hosting has not been decided. See «Open items before
  production» in [docs/ROADMAP.md](docs/ROADMAP.md), including virus scanning of uploads (not
  performed yet), real email/SMS delivery and the security review that has not yet taken place.
- The Nafath sign-in is a clearly marked mock and must never be enabled in production.

## What is never in this repository

- `.env` files, real passwords, API keys, tokens, session secrets or database credentials. Every
  example uses `<placeholder>` values; test suites use obviously fake values only.
- Database dumps or volumes, uploaded files (`storage/`), logs, exports and scratch files.
- Personal data of real people (names, emails, phone numbers, national IDs). Seeds and tests use
  fictitious data.
- The Presidency's private source documents, review screenshots and the design lab (see
  [docs/ONBOARDING.md](docs/ONBOARDING.md#private-material)).

If you find any of these in the repository or its history, report it privately as above.
