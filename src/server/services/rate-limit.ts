import "server-only";

// Fixed-window limiter for server actions that call Better Auth directly (direct `auth.api`
// calls bypass Better Auth's HTTP rate limiter). In-memory: suitable for the single-instance
// local deployment; replace with a shared store before running several instances.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
