"use client";

import { Check, FileQuestion, FileUp, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { uploadRequestFile } from "@/components/requests/upload-file";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { addVersionAction, attachFileAction, attachOwnFileAction, removeFileAction } from "@/server/actions/requests";
import type { FileView } from "@/server/services/requests/read";
import { FileRow } from "./files";

export type AttachmentCardProps = {
  requestId: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  /** «ملفات PDF، مستندات Word (docx)» … for the help line. */
  acceptedText: string;
  /** accept attribute for the file input. */
  accept: string;
  maxMb: number;
  files: FileView[];
  /** Files can be removed only from a draft that was never submitted. */
  canRemove: boolean;
  /** The completeness check's message for this file, if any. */
  error?: string;
  /** The association's own extra files (D-115): no requirement, any allowed type, never «required». */
  own?: boolean;
};

/**
 * One file the initiative asks for, as a large card (D-102): whether it is attached, the attached
 * files with «تنزيل», «استبدال بنسخة أحدث» and (draft only) «حذف», and a large button or a dropped
 * file to attach. Each file is saved as soon as it is uploaded.
 */
export function AttachmentCard({ requestId, requirementKey, label, isRequired, acceptedText, accept, maxMb, files, canRemove, error, own }: AttachmentCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, startRefresh] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const attached = files.length > 0;

  function choose(attachmentId: string | null) {
    target.current = attachmentId;
    input.current?.click();
  }

  async function onFile(file: File) {
    const attachmentId = target.current;
    setMessage(null);
    setDone(null);
    setBusy(true);
    setProgress(0);
    const uploaded = await uploadRequestFile(requestId, "request", file, maxMb, setProgress);
    if (!uploaded.ok) {
      setBusy(false);
      setMessage(uploaded.message);
      return;
    }
    const saved = attachmentId
      ? await addVersionAction(requestId, attachmentId, uploaded.uploadId)
      : own
        ? await attachOwnFileAction(requestId, uploaded.uploadId)
        : await attachFileAction(requestId, requirementKey, uploaded.uploadId);
    setBusy(false);
    if (!saved.ok) setMessage(saved.message ?? "تعذّر حفظ الملف. أعيدوا المحاولة.");
    else {
      setDone(attachmentId ? "حُفظت النسخة الأحدث من الملف." : "أُرفق الملف وحُفظ.");
      startRefresh(() => router.refresh());
    }
  }

  return (
    <div
      id={`attachment-${requirementKey}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        target.current = null;
        if (file && !busy) void onFile(file);
      }}
      className={cn(
        "scroll-mt-28 rounded-lg border p-4 transition-colors sm:p-5 lg:scroll-mt-44",
        dragging ? "border-primary bg-primary-soft" : error ? "border-st-bad bg-surface" : attached ? "border-st-ok/40 bg-surface" : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 className="text-base font-bold text-ink">{label}</h4>
        {isRequired ? null : <span className="text-sm text-ink-muted">(اختياري)</span>}
        {own ? (
          attached ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-st-ok">
              <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />
              {files.length === 1 ? "أُرفق ملف واحد" : `أُرفقت ${formatNumber(files.length)} ملفات`}
            </span>
          ) : null
        ) : attached ? (
          <span className="inline-flex items-center gap-1 text-sm font-bold text-st-ok">
            <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />
            تم الإرفاق
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", isRequired ? "text-st-warn" : "text-ink-muted")}>
            <FileQuestion aria-hidden="true" strokeWidth={1.75} className="size-4" />
            لم يُرفق بعد
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        الملفات المقبولة: {acceptedText}، حتى {formatNumber(maxMb)} ميغابايت للملف.
      </p>

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
          if (file) void onFile(file);
        }}
      />

      {attached ? (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((f) => (
            <FileRow
              key={f.attachmentId}
              requestId={requestId}
              file={f}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => choose(f.attachmentId)} disabled={busy}>
                    <RefreshCw aria-hidden="true" strokeWidth={1.75} />
                    استبدال بنسخة أحدث
                  </Button>
                  {canRemove ? (
                    <ConfirmDialog
                      trigger={
                        <>
                          <Trash2 aria-hidden="true" strokeWidth={1.75} />
                          حذف
                        </>
                      }
                      triggerVariant="danger"
                      triggerSize="sm"
                      title="حذف الملف"
                      description={
                        <>
                          سيُحذف الملف «<bdi>{f.current?.fileName ?? f.title}</bdi>» من هذا الطلب، ولا يمكن استعادته.
                        </>
                      }
                      confirmLabel="نعم، احذف الملف"
                      confirmVariant="danger"
                      onConfirm={async () => {
                        const r = await removeFileAction(requestId, f.attachmentId);
                        if (!r.ok) setMessage(r.message ?? "تعذّر حذف الملف.");
                        router.refresh();
                      }}
                    />
                  ) : null}
                </>
              }
            />
          ))}
        </ul>
      ) : null}

      {busy ? (
        <div role="status" className="mt-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
            جارٍ رفع الملف… {formatNumber(progress)}٪
          </p>
          <span aria-hidden="true" className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </span>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant={attached ? "outline" : "gold"} onClick={() => choose(null)}>
            <FileUp aria-hidden="true" strokeWidth={1.75} />
            {attached ? "إرفاق ملف آخر" : "اختيار ملف لإرفاقه"}
          </Button>
          <span className="text-sm text-ink-muted">أو اسحبوا الملف وأفلتوه هنا.</span>
        </div>
      )}

      {done ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-st-ok">
          <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />
          {done}
        </p>
      ) : null}
      {message || error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {message ?? error}
        </p>
      ) : null}
    </div>
  );
}
