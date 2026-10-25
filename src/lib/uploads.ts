// Upload rules shared by every upload (templates now, association attachments in Phase 3).
// Pure functions; the byte-level checks live in src/server/uploads/stage.ts.

import { ALLOWED_FILE_TYPES_TEXT, type UploadGroup } from "./validation/settings";

/**
 * The only file types accepted (owner, Phase 2b stop 2): no legacy .doc/.xls, nothing
 * macro-enabled, no SVG, HTML or video. `detected` is what `file-type` reports for real content.
 */
export const FILE_TYPES = {
  pdf: { group: "pdf", mimes: ["application/pdf"], detected: "pdf", canonical: "application/pdf", label: "PDF" },
  docx: {
    group: "word",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    detected: "docx",
    canonical: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
  },
  xlsx: {
    group: "excel",
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    detected: "xlsx",
    canonical: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel",
  },
  png: { group: "image", mimes: ["image/png"], detected: "png", canonical: "image/png", label: "PNG" },
  jpg: { group: "image", mimes: ["image/jpeg", "image/jpg"], detected: "jpg", canonical: "image/jpeg", label: "JPEG" },
  jpeg: { group: "image", mimes: ["image/jpeg", "image/jpg"], detected: "jpg", canonical: "image/jpeg", label: "JPEG" },
  webp: { group: "image", mimes: ["image/webp"], detected: "webp", canonical: "image/webp", label: "WebP" },
} as const satisfies Record<string, { group: UploadGroup; mimes: readonly string[]; detected: string; canonical: string; label: string }>;

export type AllowedExtension = keyof typeof FILE_TYPES;

/** Extensions that make a name suspicious when they appear before the real one («x.php.pdf»). */
const KNOWN_EXTENSIONS = new Set([
  ...Object.keys(FILE_TYPES),
  "exe", "dll", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "mjs", "jar", "sh", "php", "phtml", "asp", "aspx", "jsp", "cgi", "pl", "py",
  "html", "htm", "xhtml", "shtml", "svg", "svgz", "xml", "hta", "lnk", "iso", "zip", "rar", "7z",
  "doc", "dot", "docm", "dotm", "xls", "xlt", "xlsm", "xltm", "xlsb", "ppt", "pptm", "pptx", "rtf",
  "mp4", "mov", "avi", "mkv", "webm", "wmv", "m4v",
]);

export type NameCheck = { ok: true; name: string; ext: AllowedExtension } | { ok: false; message: string };

/**
 * Cleans a client-supplied file name (no folders, control or bidi-override characters, at most 150
 * characters) and checks its extension: one real extension among the allowed ones, and no other
 * known extension earlier in the name.
 */
export function checkFileName(raw: string): NameCheck {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const name = base.normalize("NFC").replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  if (!name || name === "." || name === "..") return { ok: false, message: "اسم الملف غير صالح." };
  if (name.length > 150) return { ok: false, message: "اسم الملف طويل جدًا؛ اختصره إلى ١٥٠ حرفًا أو أقل." };
  const parts = name.split(".");
  if (parts.length < 2 || parts[0] === "") return { ok: false, message: "للملف امتداد غير معروف." };
  const ext = parts[parts.length - 1].toLowerCase();
  if (!(ext in FILE_TYPES)) return { ok: false, message: `نوع الملف غير مسموح به. الأنواع المقبولة: ${ALLOWED_FILE_TYPES_TEXT}.` };
  if (parts.slice(1, -1).some((p) => KNOWN_EXTENSIONS.has(p.toLowerCase()))) {
    return { ok: false, message: "يحتوي اسم الملف على امتداد مزدوج؛ أعد تسمية الملف بامتداد واحد." };
  }
  return { ok: true, name, ext: ext as AllowedExtension };
}

/** Extensions allowed by the settings' upload groups. */
export function extensionsForGroups(groups: readonly string[]): AllowedExtension[] {
  return (Object.keys(FILE_TYPES) as AllowedExtension[]).filter((ext) => groups.includes(FILE_TYPES[ext].group));
}

/** For the file input's accept attribute. */
export function acceptAttribute(groups: readonly string[]): string {
  const exts = extensionsForGroups(groups);
  return [...exts.map((e) => `.${e}`), ...new Set(exts.flatMap((e) => FILE_TYPES[e].mimes))].join(",");
}

/**
 * Content-Disposition for a download: always `attachment` (owner, Phase 2b stop 2), with an ASCII
 * fallback name and the real (often Arabic) name in RFC 5987 `filename*`.
 */
export function attachmentDisposition(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) : "";
  // Plain ASCII letters, digits, spaces, dots, dashes and underscores only; «file» when nothing is left.
  const asciiStem = (dot > 0 ? fileName.slice(0, dot) : fileName).replace(/[^A-Za-z0-9 ._-]/g, "").replace(/\s+/g, " ").trim();
  const fallback = `${/[A-Za-z0-9]/.test(asciiStem) ? asciiStem : "file"}${ext ? `.${ext}` : ""}`;
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
