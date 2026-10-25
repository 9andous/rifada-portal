import type { NextRequest } from "next/server";
import { userFromRequest } from "@/server/auth/session";
import { jsonResponse as json, sameOrigin, uploadContentLength, uploadFileName } from "@/server/http/upload-route";
import { canUploadTo, uploadContext, type UploadPurpose } from "@/server/services/requests/attachments";
import { stageUpload } from "@/server/uploads/stage";

// Streams one request or comment file into staging (D-074, D-081). `?purpose=request` (the
// officer's own draft or returned request) or `?purpose=comment` (any user who may comment on the
// submitted request). Permission is checked before a byte is written; the staged upload is bound
// to this request and committed later by a server action.

const PURPOSES: readonly UploadPurpose[] = ["request", "comment"];

export async function POST(request: NextRequest, ctx: RouteContext<"/api/requests/[id]/uploads">) {
  if (!sameOrigin(request)) return json(403, { message: "طلب غير مسموح به." });
  const signedIn = await userFromRequest(request);
  if (!signedIn) return json(401, { message: "انتهت الجلسة؛ سجّل الدخول مرة أخرى." });
  const { user, sessionId } = signedIn;
  const { id } = await ctx.params;
  const purpose = request.nextUrl.searchParams.get("purpose") as UploadPurpose | null;
  if (!purpose || !PURPOSES.includes(purpose)) return json(400, { message: "طلب غير صالح." });
  if (user.mustChangePassword || !(await canUploadTo(user, id, purpose))) return json(403, { message: "لا يمكن رفع ملفات إلى هذا الطلب." });

  const fileName = uploadFileName(request);
  if (fileName === null) return json(400, { message: "اسم الملف غير صالح." });
  const result = await stageUpload({
    uploaderId: user.id,
    sessionId,
    fileName,
    declaredMime: request.headers.get("content-type"),
    contentLength: uploadContentLength(request),
    body: request.body,
    context: uploadContext(id),
  });
  if (!result.ok) return json(result.status, { message: result.message });
  return json(201, { uploadId: result.uploadId, fileName: result.fileName, size: result.size, mime: result.mime });
}
