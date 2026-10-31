"use client";

import { CircleCheck, LoaderCircle, MessagesSquare, Paperclip, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { useRef, useState, useTransition } from "react";
import { uploadRequestFile } from "@/components/requests/upload-file";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Alert } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatFileSize, formatNumber } from "@/lib/format";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { addCommentAction } from "@/server/actions/requests";
import type { CommentView } from "@/server/services/requests/read";
import { FileRow } from "./files";

type Staged = { uploadId: string; fileName: string; size: number };

/**
 * The messages between the association and the unit about one request (D-102): each message says
 * clearly who wrote it, in large type, newest last; then one large box to write a new message, with
 * an optional file. Officers never receive internal notes from the server.
 */
export function AssociationMessages({
  requestId,
  comments,
  canComment,
  canAttach,
  accept,
  maxMb,
}: {
  requestId: string;
  comments: CommentView[];
  canComment: boolean;
  canAttach: boolean;
  accept: string;
  maxMb: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function addFile(file: File) {
    setMessage(null);
    setUploading(true);
    const r = await uploadRequestFile(requestId, "comment", file, maxMb);
    setUploading(false);
    if (r.ok) setFiles((f) => [...f, { uploadId: r.uploadId, fileName: r.fileName, size: r.size }]);
    else setMessage(r.message);
  }

  function send() {
    setSent(false);
    const fd = new FormData();
    fd.set("body", body);
    for (const f of files) fd.append("uploadId", f.uploadId);
    start(async () => {
      const r = await addCommentAction(requestId, {}, fd);
      if (!r.ok) {
        setMessage(r.message ?? r.errors?.body ?? r.errors?.file ?? "تعذّر إرسال الرسالة. أعيدوا المحاولة.");
        return;
      }
      setBody("");
      setFiles([]);
      setMessage(null);
      setSent(true);
      toast("أُرسلت رسالتكم", { description: "وصلت إلى الوحدة الإشرافية." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {comments.length === 0 ? (
        <p className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-3 text-base text-ink-muted">
          <MessagesSquare aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-subtle" />
          لا توجد رسائل بعد. يمكنكم كتابة استفساركم في المربع أدناه.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn("rounded-lg border-s-4 px-4 py-3.5 sm:px-5", c.author.isStaff ? "border-primary bg-primary-soft/50" : "border-line-strong bg-surface-muted")}
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-base">
                <span className="font-bold text-ink">{c.author.isStaff ? "من الوحدة الإشرافية" : "منكم"}</span>
                <span className="text-ink-muted">— {c.author.name}</span>
              </p>
              <p className="mt-1.5 whitespace-pre-line text-base leading-relaxed text-ink">{c.body}</p>
              {c.files.length ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {c.files.map((f) => (
                    <FileRow key={f.attachmentId} requestId={requestId} file={f} />
                  ))}
                </ul>
              ) : null}
              <DateDisplay date={c.createdAt} withTime className="mt-2 block text-sm text-ink-muted" />
            </li>
          ))}
        </ol>
      )}

      {canComment ? (
        <div data-print="hide" className="rounded-lg border border-line-strong bg-surface p-4">
          <label htmlFor="message-body" className="text-base font-bold text-ink">
            اكتبوا رسالتكم إلى الوحدة الإشرافية
          </label>
          <p className="mt-0.5 text-sm text-ink-muted">تصل الرسالة إلى المشرف المختص بهذا الطلب، ويظهر رده هنا.</p>
          <textarea
            id="message-body"
            rows={4}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSent(false);
            }}
            maxLength={REQUEST_LIMITS.comment}
            className="mt-3 w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
            placeholder="مثال: نرجو إفادتنا عن الملف المطلوب إرفاقه…"
          />
          {files.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f.uploadId} className="inline-flex items-center gap-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-base">
                  <Paperclip aria-hidden="true" strokeWidth={1.75} className="size-5 text-ink-muted" />
                  <bdi>{f.fileName}</bdi>
                  <span className="text-ink-muted">({formatFileSize(f.size)})</span>
                  <button
                    type="button"
                    onClick={() => setFiles((all) => all.filter((x) => x.uploadId !== f.uploadId))}
                    className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-danger hover:bg-danger/10"
                  >
                    <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    إزالة
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {message ? (
            <Alert tone="danger" className="mt-3 text-base">
              {message}
            </Alert>
          ) : null}
          {sent ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-base font-semibold text-st-ok">
              <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-5" />
              أُرسلت رسالتكم، وتظهر الآن في القائمة أعلاه.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="gold" onClick={send} disabled={sending || uploading || !body.trim()}>
              {sending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" strokeWidth={1.75} />}
              {sending ? "جارٍ الإرسال…" : "إرسال الرسالة"}
            </Button>
            {canAttach ? (
              <>
                <input
                  ref={input}
                  type="file"
                  accept={accept}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void addFile(file);
                  }}
                />
                <Button variant="outline" onClick={() => input.current?.click()} disabled={uploading || files.length >= REQUEST_LIMITS.commentFiles}>
                  {uploading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Paperclip aria-hidden="true" strokeWidth={1.75} />}
                  {uploading ? "جارٍ رفع الملف…" : "إرفاق ملف مع الرسالة"}
                </Button>
                <span className="text-sm text-ink-muted">
                  اختياري: حتى {formatNumber(REQUEST_LIMITS.commentFiles)} ملفات، {formatNumber(maxMb)} ميغابايت للملف.
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
