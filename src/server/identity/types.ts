// National identity sign-in contract. The current implementation is a mock
// (see nafath-mock-plugin.ts); a real Nafath integration implements the same shape.

export type IdentityChallenge = {
  transactionId: string;
  /** Number the user must pick in the Nafath app. */
  code: string;
  expiresInSeconds: number;
};

export interface IdentityProvider {
  readonly id: string;
  /** Starts an approval request for the given national ID. */
  start(nationalId: string): Promise<IdentityChallenge>;
  /** Completes the request after the user approves it; establishes the session. */
  complete(transactionId: string): Promise<void>;
}
