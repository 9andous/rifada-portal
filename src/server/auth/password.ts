import { hash, verify } from "@node-rs/argon2";

// argon2id with OWASP-recommended parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword({ hash: digest, password }: { hash: string; password: string }): Promise<boolean> {
  return verify(digest, password);
}

/** Password policy shared by every place a password is set. */
export const PASSWORD_MIN_LENGTH = 10;
