"use client";

import { formatNumber } from "@/lib/format";

export type UploadOutcome = { ok: true; uploadId: string; fileName: string; size: number } | { ok: false; message: string };

/**
 * Streams one file to POST /api/requests/[id]/uploads (raw body, name in x-file-name). The server
 * checks the user, the request, the name, the type and the content again; nothing here is trusted.
 */
export function uploadRequestFile(
  requestId: string,
  purpose: "request" | "comment",
  file: File,
  maxMb: number,
  onProgress?: (percent: number) => void,
): Promise<UploadOutcome> {
  if (file.size > maxMb * 1024 * 1024) {
    return Promise.resolve({ ok: false, message: `حجم الملف أكبر من الحد المسموح به (${formatNumber(maxMb)} ميغابايت).` });
  }
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/requests/${requestId}/uploads?purpose=${purpose}`);
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    request.onload = () => {
      let body: { uploadId?: string; fileName?: string; size?: number; message?: string } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Non-JSON error page.
      }
      if (request.status === 201 && body.uploadId) resolve({ ok: true, uploadId: body.uploadId, fileName: body.fileName ?? file.name, size: body.size ?? file.size });
      else resolve({ ok: false, message: body.message ?? "تعذّر رفع الملف. أعد المحاولة." });
    };
    request.onerror = () => resolve({ ok: false, message: "انقطع الاتصال أثناء رفع الملف. أعد المحاولة." });
    request.send(file);
  });
}
