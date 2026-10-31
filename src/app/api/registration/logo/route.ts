import type { NextRequest } from "next/server";
import { IMAGE_MAX_MB, REGISTRATION_LOGO_CONTEXT, REGISTRATION_UPLOADER } from "@/lib/images";
import { jsonResponse as json, sameOrigin, uploadContentLength, uploadFileName } from "@/server/http/upload-route";
import { rateLimit } from "@/server/services/rate-limit";
import { stageUpload } from "@/server/uploads/stage";

// Public: stages the logo an association sends with its registration (D-100). There is no session,
// so the staged upload is bound to the registration context instead of a user; its random id is
// what the form posts, and it is usable once within the hour. PNG, JPEG or WebP only, at most
// IMAGE_MAX_MB, and limited per client.

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json(403, { message: "طلب غير مسموح به." });
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  if (!rateLimit(`registration-logo:${client}`, 10, 60 * 60 * 1000)) return json(429, { message: "تجاوزتم عدد المحاولات المسموح بها. حاولوا بعد قليل." });

  const fileName = uploadFileName(request);
  if (fileName === null) return json(400, { message: "اسم الملف غير صالح." });
  const result = await stageUpload({
    uploaderId: REGISTRATION_UPLOADER,
    sessionId: null,
    fileName,
    declaredMime: request.headers.get("content-type"),
    contentLength: uploadContentLength(request),
    body: request.body,
    context: REGISTRATION_LOGO_CONTEXT,
    only: { groups: ["image"], maxMb: IMAGE_MAX_MB },
  });
  if (!result.ok) return json(result.status, { message: result.message });
  return json(201, { uploadId: result.uploadId, fileName: result.fileName, size: result.size, mime: result.mime });
}
