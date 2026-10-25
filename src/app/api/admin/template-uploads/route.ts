import type { NextRequest } from "next/server";
import { userFromRequest } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { jsonResponse as json, sameOrigin, uploadContentLength, uploadFileName } from "@/server/http/upload-route";
import { stageUpload } from "@/server/uploads/stage";

// Streams one template file into staging (D-063, D-064). The raw file is the request body; its
// name travels URI-encoded in `x-file-name` and its type in Content-Type. The response carries the
// upload id that the template form then submits. Super admin only.

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json(403, { message: "طلب غير مسموح به." });
  const signedIn = await userFromRequest(request);
  if (!signedIn) return json(401, { message: "انتهت الجلسة؛ سجّل الدخول مرة أخرى." });
  const { user, sessionId } = signedIn;
  if (user.mustChangePassword || !can(user.role, "content.manage")) return json(403, { message: "لا تملك صلاحية رفع الملفات هنا." });

  const fileName = uploadFileName(request);
  if (fileName === null) return json(400, { message: "اسم الملف غير صالح." });
  const result = await stageUpload({
    uploaderId: user.id,
    sessionId,
    fileName,
    declaredMime: request.headers.get("content-type"),
    contentLength: uploadContentLength(request),
    body: request.body,
  });
  if (!result.ok) return json(result.status, { message: result.message });
  return json(201, { uploadId: result.uploadId, fileName: result.fileName, size: result.size, mime: result.mime });
}
