import type { NextRequest } from "next/server";
import { IMAGE_CONTEXT, IMAGE_MAX_MB } from "@/lib/images";
import { userFromRequest } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { jsonResponse as json, sameOrigin, uploadContentLength, uploadFileName } from "@/server/http/upload-route";
import { stageUpload } from "@/server/uploads/stage";

// Streams one profile picture or association logo into staging, like the template uploads, but
// with fixed rules: PNG, JPEG or WebP only, at most IMAGE_MAX_MB, whatever the document settings
// say. The upload is bound to the «image» context, so only the user and association forms take it.

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json(403, { message: "طلب غير مسموح به." });
  const signedIn = await userFromRequest(request);
  if (!signedIn) return json(401, { message: "انتهت الجلسة؛ سجّل الدخول مرة أخرى." });
  const { user, sessionId } = signedIn;
  if (user.mustChangePassword || !(can(user.role, "users.manage") || can(user.role, "associations.manage"))) {
    return json(403, { message: "لا تملك صلاحية رفع الصور هنا." });
  }

  const fileName = uploadFileName(request);
  if (fileName === null) return json(400, { message: "اسم الملف غير صالح." });
  const result = await stageUpload({
    uploaderId: user.id,
    sessionId,
    fileName,
    declaredMime: request.headers.get("content-type"),
    contentLength: uploadContentLength(request),
    body: request.body,
    context: IMAGE_CONTEXT,
    only: { groups: ["image"], maxMb: IMAGE_MAX_MB },
  });
  if (!result.ok) return json(result.status, { message: result.message });
  return json(201, { uploadId: result.uploadId, fileName: result.fileName, size: result.size, mime: result.mime });
}
