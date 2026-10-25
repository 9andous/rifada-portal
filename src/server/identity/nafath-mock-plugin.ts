// ============================================================================
// MOCK — NOT A REAL NAFATH INTEGRATION.
// Simulates the Nafath (النفاذ الوطني الموحد) app-approval flow so the login screen and
// session handling can be built and demonstrated. It signs in the active account whose
// optional `nationalId` matches. Replace with a real provider implementing IdentityProvider
// (src/server/identity/types.ts); the login UI and session handling stay the same.
// ============================================================================

import { randomInt, randomUUID } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

const TRANSACTION_TTL_MS = 2 * 60 * 1000;
const NATIONAL_ID = /^[12]\d{9}$/;
const identifierFor = (transactionId: string) => `nafath-mock:${transactionId}`;

export const NAFATH_MOCK_ERRORS = {
  INVALID_NATIONAL_ID: "INVALID_NATIONAL_ID",
  TRANSACTION_EXPIRED: "TRANSACTION_EXPIRED",
  NOT_LINKED: "NOT_LINKED",
} as const;

export function nafathMock(): BetterAuthPlugin {
  return {
    id: "nafath-mock",
    rateLimit: [{ window: 60, max: 5, pathMatcher: (path) => path.startsWith("/nafath-mock/") }],
    endpoints: {
      nafathMockStart: createAuthEndpoint(
        "/nafath-mock/start",
        { method: "POST", body: z.object({ nationalId: z.string() }) },
        async (ctx) => {
          const nationalId = ctx.body.nationalId.trim();
          if (!NATIONAL_ID.test(nationalId)) {
            throw new APIError("BAD_REQUEST", { code: NAFATH_MOCK_ERRORS.INVALID_NATIONAL_ID });
          }
          // Like the real service, starting a request reveals nothing about whether an account exists.
          const transactionId = randomUUID();
          const code = String(randomInt(10, 100));
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: identifierFor(transactionId),
            value: JSON.stringify({ nationalId, code }),
            expiresAt: new Date(Date.now() + TRANSACTION_TTL_MS),
          });
          return ctx.json({ transactionId, code, expiresInSeconds: TRANSACTION_TTL_MS / 1000 });
        },
      ),
      nafathMockComplete: createAuthEndpoint(
        "/nafath-mock/complete",
        { method: "POST", body: z.object({ transactionId: z.string().uuid() }) },
        async (ctx) => {
          // Stands in for the user approving the request in the Nafath app.
          const record = await ctx.context.internalAdapter.consumeVerificationValue(
            identifierFor(ctx.body.transactionId),
          );
          if (!record || record.expiresAt.getTime() < Date.now()) {
            throw new APIError("BAD_REQUEST", { code: NAFATH_MOCK_ERRORS.TRANSACTION_EXPIRED });
          }
          const { nationalId } = JSON.parse(record.value) as { nationalId: string };
          const user = await ctx.context.adapter.findOne<{ id: string; isActive: boolean }>({
            model: "user",
            where: [{ field: "nationalId", value: nationalId }],
          });
          if (!user || !user.isActive) {
            throw new APIError("FORBIDDEN", { code: NAFATH_MOCK_ERRORS.NOT_LINKED });
          }
          const fullUser = await ctx.context.internalAdapter.findUserById(user.id);
          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!fullUser || !session) throw new APIError("INTERNAL_SERVER_ERROR");
          await setSessionCookie(ctx, { session, user: fullUser });
          return ctx.json({ ok: true });
        },
      ),
    },
  };
}
