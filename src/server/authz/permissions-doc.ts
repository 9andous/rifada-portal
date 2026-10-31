// Renders the permission matrix as Markdown for docs/PERMISSIONS.md.
// Regenerate with `npm run docs:permissions`; a unit test fails when the file is stale.

import { PERMISSIONS, type Scope } from "./permissions";
import { ROLE_LABELS, ROLES } from "./roles";

const SCOPE_LABEL: Record<Scope, string> = {
  all: "all",
  tracks: "own tracks",
  own: "own association",
};

export function renderPermissionsDoc(): string {
  const header = `| Action | Description | ${ROLES.map((r) => `${r} (${ROLE_LABELS[r]})`).join(" | ")} |`;
  const divider = `|---|---|${ROLES.map(() => "---").join("|")}|`;
  const rows = Object.entries(PERMISSIONS).map(([action, p]) => {
    const grants: Partial<Record<(typeof ROLES)[number], Scope>> = p.grants;
    const cells = ROLES.map((role) => {
      const scope = grants[role];
      return scope ? SCOPE_LABEL[scope] : "—";
    });
    return `| \`${action}\` | ${p.description} | ${cells.join(" | ")} |`;
  });

  return `# Permission matrix

> Generated from \`src/server/authz/permissions.ts\` by \`npm run docs:permissions\`. Do not edit by hand.

Every rule is enforced on the server. Three layers apply to each request:

1. **Proxy** (\`src/proxy.ts\`): signed-out visitors are sent to the login page; a role opening another
   role's area (\`/admin\`, \`/manager\`, \`/supervisor\`, \`/association\`) gets HTTP 403; accounts with a
   pending first-login password change are sent to \`/account/change-password\`.
2. **Area layouts** re-check the role and render the permission-denied state.
3. **Data access**: every query of scoped data uses the scopers in \`src/server/authz/scope.ts\`, and every
   server action and route handler checks \`can()\` before acting.

Scopes: **all** = every record; **own tracks** = records in tracks assigned to the supervisor (D-123);
**own association** = records of the officer's association; **—** = denied.

${header}
${divider}
${rows.join("\n")}

## Rules worth calling out

- Association officers never see internal notes (\`comments.isInternal\`). They are filtered in
  \`scopeComments()\`, which every comment reader uses, including lists, exports, print views and PDFs.
- A supervisor with no assigned programs sees no requests at all.
- An officer account is bound to exactly one association; it sees only that association's records.
- The super admin administers the system but does not take part in request review.
- Deactivated accounts cannot sign in by any method, and their open sessions stop working.
`;
}
