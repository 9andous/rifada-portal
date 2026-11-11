import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { attachmentDisposition } from "@/lib/uploads";
import { userFromRequest } from "@/server/auth/session";
import { registrationLetter } from "@/server/services/registrations";

// The letter («الخطاب») of an association's registration (D-149): for the super admin only, never a
// public URL, always as a download. Anything the user may not see is answered 404.

const NO_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/admin/registrations/[id]/letter">) {
  const signedIn = await userFromRequest(request);
  if (!signedIn || signedIn.user.mustChangePassword) return new Response("Unauthorized", { status: 401, headers: NO_CACHE });
  const { id } = await ctx.params;
  const file = await registrationLetter(signedIn.user, id);
  if (!file) return new Response("Not found", { status: 404, headers: NO_CACHE });
  return new Response(Readable.toWeb(file.stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      ...NO_CACHE,
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": attachmentDisposition(file.fileName),
      "Referrer-Policy": "no-referrer",
    },
  });
}
