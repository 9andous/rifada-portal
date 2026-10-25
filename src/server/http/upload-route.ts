import "server-only";
import type { NextRequest } from "next/server";

// Shared pieces of the upload route handlers (templates, request files).

/** The request comes from this application's own pages (CSRF guard for raw-body uploads). */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([request.nextUrl.origin]);
  if (process.env.BETTER_AUTH_URL) allowed.add(new URL(process.env.BETTER_AUTH_URL).origin);
  return allowed.has(origin);
}

export const jsonResponse = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/** The URI-encoded `x-file-name` header, or null when it cannot be decoded. */
export function uploadFileName(request: NextRequest): string | null {
  try {
    return decodeURIComponent(request.headers.get("x-file-name") ?? "");
  } catch {
    return null;
  }
}

export function uploadContentLength(request: NextRequest): number | null {
  const length = request.headers.get("content-length");
  return length !== null && /^\d+$/.test(length) ? Number(length) : null;
}
