import "server-only";
import type { Readable } from "node:stream";
import { fileTypeFromFile } from "file-type";
import { formatNumber } from "@/lib/format";
import { checkFileName, FILE_TYPES, type AllowedExtension } from "@/lib/uploads";
import { getStorage, StorageError } from "@/server/storage/storage";
import { getSetting } from "@/server/settings/read";
import { getMalwareScanner } from "./scanner";

// The upload pipeline (Phase 2b stop 2; reused by Phase 3): stream into staging with a byte limit,
// check name, extension, declared MIME type and real content, then keep the staged file for one
// hour, usable once, and only by the user who uploaded it (D-064).

export const STAGING_TTL_MS = 60 * 60 * 1000;
const UPLOAD_ID = /^[a-f0-9]{32}$/;

export type StagedMeta = {
  uploaderId: string;
  sessionId: string | null;
  /** Where the upload may be used; null for uploads that are not bound (templates). */
  context?: string | null;
  createdAt: number;
  fileName: string;
  ext: AllowedExtension;
  mime: string;
  size: number;
  sha256: string;
};

export type StageResult =
  | { ok: true; uploadId: string; fileName: string; size: number; mime: string }
  | { ok: false; status: 400 | 413 | 415; message: string };

const MB = 1024 * 1024;

/**
 * Validates and stages one upload. `declaredMime` is the request's Content-Type; `contentLength`
 * (if sent) is checked before reading. Nothing is kept when any check fails.
 */
export async function stageUpload(input: {
  uploaderId: string;
  sessionId: string | null;
  fileName: string;
  declaredMime: string | null;
  contentLength: number | null;
  body: ReadableStream<Uint8Array> | Readable | null;
  /** Binds the upload to where it may be used (e.g. `request:<id>`); checked again on consume. */
  context?: string | null;
}): Promise<StageResult> {
  const [maxMb, groups] = await Promise.all([getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);
  const maxBytes = maxMb * MB;
  const tooLarge = `حجم الملف أكبر من الحد المسموح به (${formatNumber(maxMb)} ميغابايت).`;

  const name = checkFileName(input.fileName);
  if (!name.ok) return { ok: false, status: 415, message: name.message };
  const type = FILE_TYPES[name.ext];
  if (!(groups as readonly string[]).includes(type.group)) {
    return { ok: false, status: 415, message: "هذا النوع من الملفات غير مسموح به حاليًا في إعدادات المنصة." };
  }
  const declared = (input.declaredMime ?? "").split(";")[0].trim().toLowerCase();
  if (!(type.mimes as readonly string[]).includes(declared)) {
    return { ok: false, status: 415, message: "نوع الملف المعلن لا يطابق امتداده." };
  }
  if (input.contentLength !== null && input.contentLength > maxBytes) return { ok: false, status: 413, message: tooLarge };
  if (input.contentLength === 0 || !input.body) return { ok: false, status: 400, message: "الملف فارغ." };

  const storage = getStorage();
  await storage.cleanupStaging(STAGING_TTL_MS);
  let written;
  try {
    written = await storage.writeStaging(input.body, maxBytes);
  } catch (error) {
    if (error instanceof StorageError && error.code === "too_large") return { ok: false, status: 413, message: tooLarge };
    throw error;
  }
  const reject = async (status: 400 | 413 | 415, message: string): Promise<StageResult> => {
    await storage.remove(written.key);
    return { ok: false, status, message };
  };
  if (written.size === 0) return reject(400, "الملف فارغ.");

  const detected = await fileTypeFromFile(storage.localPath(written.key));
  if (!detected || detected.ext !== type.detected) {
    return reject(415, "محتوى الملف لا يطابق امتداده؛ تأكد من أن الملف سليم وغير معاد التسمية.");
  }
  const scan = await getMalwareScanner().scan(storage.localPath(written.key));
  if (!scan.clean) return reject(415, "رُفض الملف لأن فحص الأمان لم يجتزه.");

  const meta: StagedMeta = {
    uploaderId: input.uploaderId,
    sessionId: input.sessionId,
    context: input.context ?? null,
    createdAt: Date.now(),
    fileName: name.name,
    ext: name.ext,
    mime: type.canonical,
    size: written.size,
    sha256: written.sha256,
  };
  await storage.writeSidecar(written.key, meta);
  return { ok: true, uploadId: written.key.slice("staging/".length), fileName: meta.fileName, size: meta.size, mime: meta.mime };
}

export type ConsumedUpload = { storageKey: string; fileName: string; mime: string; size: number; sha256: string };

export const NOT_USABLE = "الملف المرفوع غير متاح؛ ارفعه مرة أخرى.";

/**
 * The metadata of a staged upload the user may still use (same uploader, same context, within one
 * hour), without consuming it; null otherwise. Lets a service validate before committing.
 */
export async function peekUpload(
  uploaderId: string,
  uploadId: string,
  context: string | null = null,
  now: number = Date.now(),
): Promise<StagedMeta | null> {
  if (!UPLOAD_ID.test(uploadId)) return null;
  const storage = getStorage();
  const stagingKey = `staging/${uploadId}`;
  const meta = await storage.readSidecar<StagedMeta>(stagingKey);
  if (!meta || meta.uploaderId !== uploaderId || (meta.context ?? null) !== context) return null;
  if (now - meta.createdAt > STAGING_TTL_MS) {
    await storage.remove(stagingKey);
    return null;
  }
  return meta;
}

/**
 * Moves a staged upload into `area` for good. Only the uploader may use it, only once, only in the
 * context it was uploaded for, and only within one hour; every other case gets the same message so
 * ids reveal nothing.
 */
export async function consumeUpload(
  uploaderId: string,
  uploadId: string,
  area: "templates" | "attachments",
  now: number = Date.now(),
  context: string | null = null,
): Promise<{ ok: true; file: ConsumedUpload } | { ok: false; message: string }> {
  const meta = await peekUpload(uploaderId, uploadId, context, now);
  if (!meta) return { ok: false, message: NOT_USABLE };
  const storage = getStorage();
  const stagingKey = `staging/${uploadId}`;
  try {
    const storageKey = await storage.commit(stagingKey, area);
    return { ok: true, file: { storageKey, fileName: meta.fileName, mime: meta.mime, size: meta.size, sha256: meta.sha256 } };
  } catch (error) {
    if (error instanceof StorageError && error.code === "already_consumed") return { ok: false, message: NOT_USABLE };
    throw error;
  }
}
