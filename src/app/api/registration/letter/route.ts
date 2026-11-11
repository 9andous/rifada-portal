import type { NextRequest } from "next/server";
import { REGISTRATION_UPLOADER, registrationLetterContext } from "@/lib/images";
import { LETTER_MAX_MB } from "@/lib/validation/registration";
import { clientIp } from "@/server/http/client-ip";
import { jsonResponse as json, sameOrigin, uploadContentLength, uploadFileName } from "@/server/http/upload-route";
import { rateLimit } from "@/server/services/rate-limit";
import { openInvitationId } from "@/server/services/registrations";
import { stageUpload } from "@/server/uploads/stage";

// Public: stages the letter («الخطاب») an association sends with its registration (D-149). Accepted
// only through an open registration link (`?t=<token>`) and bound to that registration. PDF only, at
// most LETTER_MAX_MB, checked by content, and limited per client.

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json(403, { message: "طلب غير مسموح به." });
  const client = clientIp(request.headers);
  if (!rateLimit(`registration-letter:${client}`, 10, 60 * 60 * 1000)) return json(429, { message: "تجاوزتم عدد المحاولات المسموح بها. حاولوا بعد قليل." });
  const registrationId = await openInvitationId(request.nextUrl.searchParams.get("t") ?? "");
  if (!registrationId) return json(403, { message: "رابط التسجيل غير صالح أو انتهت صلاحيته." });

  const fileName = uploadFileName(request);
  if (fileName === null) return json(400, { message: "اسم الملف غير صالح." });
  const result = await stageUpload({
    uploaderId: REGISTRATION_UPLOADER,
    sessionId: null,
    fileName,
    declaredMime: request.headers.get("content-type"),
    contentLength: uploadContentLength(request),
    body: request.body,
    context: registrationLetterContext(registrationId),
    only: { groups: ["pdf"], maxMb: LETTER_MAX_MB },
  });
  if (!result.ok) return json(result.status, { message: result.message });
  return json(201, { uploadId: result.uploadId, fileName: result.fileName, size: result.size, mime: result.mime });
}
