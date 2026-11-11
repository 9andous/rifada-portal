import "server-only";

// The in-memory rate limiter must see one bucket per real client. A reverse proxy such as
// Caddy APPENDS the immediate client IP to X-Forwarded-For, so any values a client sends itself
// are the LEFTMOST entries and the address the trusted proxy actually observed is the RIGHTMOST.
// Reading the leftmost value (as the old clientKey did) let an attacker rotate a forged header to
// mint a fresh rate-limit bucket per request and bypass the limit. We instead read from the
// trusted end: the last entry, minus any extra trusted proxy hops (TRUSTED_PROXY_HOPS).
//
// TRUSTED_PROXY_HOPS = number of trusted proxies in front of the app BEYOND the first one
// (0 for a single Caddy). With no proxy at all there is no X-Forwarded-For and we fall back to
// x-real-ip, then a constant — so a spoofed header can no longer widen the limit.
export function clientIp(h: Headers): string {
  const hops = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (hops.length > 0) {
    const extra = Math.max(0, Math.trunc(Number(process.env.TRUSTED_PROXY_HOPS) || 0));
    const index = hops.length - 1 - extra;
    return hops[index] ?? hops[0];
  }
  return h.get("x-real-ip")?.trim() || "local";
}
