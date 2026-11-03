import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { userFromRequest } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { openImage } from "@/server/services/images";

// Profile pictures and association logos, for signed-in users only; the portraits of the home page
// statements (owner «quote», D-096) are public content and served to everyone. Unlike documents they are
// shown inline, so the response is locked down: only images that passed the upload checks, no
// sniffing, and a sandboxing CSP. The URL carries the storage key's tail (?v=), so it can be cached.

const DENY = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/images/[owner]/[id]">) {
  const { owner, id } = await ctx.params;
  if (owner !== "user" && owner !== "association" && owner !== "quote" && owner !== "registration") return new Response("Not found", { status: 404, headers: DENY });
  const isPublic = owner === "quote";
  if (!isPublic) {
    const signedIn = await userFromRequest(request);
    if (!signedIn || signedIn.user.mustChangePassword) return new Response("Unauthorized", { status: 401, headers: DENY });
    // An application's logo is for its reviewers only (D-100).
    if (owner === "registration" && !can(signedIn.user.role, "registrations.review")) return new Response("Not found", { status: 404, headers: DENY });
  }

  const image = await openImage(owner, id);
  if (!image) return new Response("Not found", { status: 404, headers: DENY });
  return new Response(Readable.toWeb(image.stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.size),
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=2592000, immutable`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
