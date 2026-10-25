import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { attachmentDisposition } from "@/lib/uploads";
import { userFromRequest } from "@/server/auth/session";
import { requestFile } from "@/server/services/requests/attachments";

// Request and comment files are served only by this handler (D-074): always as an attachment, never
// inline. The service answers null for anything the user may not read (another association's or a
// program outside the supervisor's, any draft for staff, internal-note files for officers), sent as 404.

const NO_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/requests/[id]/files/[versionId]">) {
  const signedIn = await userFromRequest(request);
  if (!signedIn || signedIn.user.mustChangePassword) return new Response("Unauthorized", { status: 401, headers: NO_CACHE });
  const { id, versionId } = await ctx.params;
  const file = await requestFile(signedIn.user, id, versionId);
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
