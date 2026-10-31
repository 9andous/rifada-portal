"use client";

import { LoaderCircle, Paperclip, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { formatFileSize, formatNumber } from "@/lib/format";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { addCommentAction } from "@/server/actions/requests";
import { uploadRequestFile } from "./upload-file";

type Staged = { uploadId: string; fileName: string; size: number };

/**
 * Writes a comment (or, for staff, an internal note) on a submitted request, with up to five files.
 * A reply keeps its parent in the data; the thread is still shown flat.
 */
export function CommentComposer({
  requestId,
  canWriteInternal,
  canAttach,
  accept,
  maxMb,
  replyTo,
  onCancelReply,
}: {
  requestId: string;
  canWriteInternal: boolean;
  canAttach: boolean;
  accept: string;
  maxMb: number;
  replyTo: { id: string; author: string; internal: boolean } | null;
  onCancelReply: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  // A reply to an internal note can only be internal.
  const isInternal = replyTo?.internal ? true : internal;

  async function addFile(file: File) {
    setMessage(null);
    setUploading(true);
    const r = await uploadRequestFile(requestId, "comment", file, maxMb);
    setUploading(false);
    if (r.ok) setFiles((f) => [...f, { uploadId: r.uploadId, fileName: r.fileName, size: r.size }]);
    else setMessage(r.message);
  }

  function send() {
    const fd = new FormData();
    fd.set("body", body);
    if (isInternal) fd.set("internal", "on");
    if (replyTo) fd.set("parentId", replyTo.id);
    for (const f of files) fd.append("uploadId", f.uploadId);
    start(async () => {
      const r = await addCommentAction(requestId, {}, fd);
      if (!r.ok) {
        setMessage(r.message ?? r.errors?.body ?? r.errors?.file ?? "تعذّر إرسال التعليق.");
        return;
      }
      setBody("");
      setFiles([]);
      setInternal(false);
      onCancelReply();
      toast("أُرسل التعليق");
      router.refresh();
    });
  }

  return (
    <div className={`rounded-sm border bg-surface p-3 ${isInternal ? "border-accent" : "border-line-strong"}`}>
      {replyTo ? (
        <p className="t-caption mb-2 flex items-center gap-2">
          ردًا على {replyTo.author}
          {replyTo.internal ? " (ملاحظة داخلية)" : ""}
          <button type="button" onClick={onCancelReply} className="inline-flex items-center text-ink-subtle hover:text-ink" aria-label="إلغاء الرد">
            <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </button>
        </p>
      ) : null}
      <label htmlFor="comment-body" className="sr-only">
        نص التعليق
      </label>
      <Textarea
        id="comment-body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={REQUEST_LIMITS.comment}
        placeholder={isInternal ? "ملاحظة للفريق، لا تظهر للجمعية…" : "اكتب تعليقك…"}
        className="border-0 px-1 focus-visible:outline-0"
      />
      {files.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.uploadId} className="t-caption inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1">
              <Paperclip aria-hidden="true" strokeWidth={1.75} className="size-4" />
              <bdi>{f.fileName}</bdi> · {formatFileSize(f.size)}
              <button type="button" onClick={() => setFiles((all) => all.filter((x) => x.uploadId !== f.uploadId))} aria-label={`إزالة ${f.fileName}`} className="hover:text-ink">
                <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <Alert tone="danger" className="mt-2">
          {message}
        </Alert>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {canWriteInternal ? (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={isInternal} disabled={Boolean(replyTo?.internal)} onChange={(e) => setInternal(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            ملاحظة داخلية — للفريق فقط
          </label>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
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
              <Button variant="ghost" size="sm" onClick={() => input.current?.click()} disabled={uploading || files.length >= REQUEST_LIMITS.commentFiles}>
                {uploading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Paperclip aria-hidden="true" strokeWidth={1.75} />}
                إرفاق ملف
              </Button>
            </>
          ) : null}
          <Button size="sm" onClick={send} disabled={sending || uploading || !body.trim()}>
            {sending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" strokeWidth={1.75} />}
            {isInternal ? "إضافة الملاحظة" : "إرسال"}
          </Button>
        </div>
      </div>
      {canAttach ? <p className="t-caption mt-1">حتى {formatNumber(REQUEST_LIMITS.commentFiles)} ملفات، {formatNumber(maxMb)} ميغابايت للملف.</p> : null}
    </div>
  );
}
