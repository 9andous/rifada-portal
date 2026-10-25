import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { attachmentDisposition } from "@/lib/uploads";
import { userFromRequest } from "@/server/auth/session";
import { templateDownload } from "@/server/services/admin/templates";

// Template downloads go only through this handler (D-063): never a public URL. Always served as an
// attachment, never rendered inline (owner, Phase 2b stop 2). `?version=n` (older files) is for the
// super admin; the service answers null for anything the user may not see, sent as 404.

const NO_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/templates/[id]/download">) {
  const signedIn = await userFromRequest(request);
  if (!signedIn || signedIn.user.mustChangePassword) {
    return new Response("Unauthorized", { status: 401, headers: NO_CACHE });
  }
  const { id } = await ctx.params;
  const versionParam = request.nextUrl.searchParams.get("version");
  const version = versionParam === null ? undefined : /^\d{1,4}$/.test(versionParam) ? Number(versionParam) : NaN;
  if (Number.isNaN(version)) return new Response("Not found", { status: 404, headers: NO_CACHE });

  const file = await templateDownload(signedIn.user, id, version);
  if (!file) return new Response("Not found", { status: 404, headers: NO_CACHE });

  return new Response(Readable.toWeb(file.stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      ...NO_CACHE,
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": attachmentDisposition(file.fileName),
      "Referrer-Policy": "no-referrer",
    },
  });
}
