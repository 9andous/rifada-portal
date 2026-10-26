"use client";

import { FilePlus2, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatNumber } from "@/lib/format";
import { addVersionAction, attachFileAction, removeFileAction } from "@/server/actions/requests";
import type { FileView } from "@/server/services/requests/read";
import { FileItem } from "./file-list";
import { uploadRequestFile } from "./upload-file";

type Props = {
  requestId: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  /** «PDF، Word (docx)» … for the help line. */
  acceptedText: string;
  /** accept attribute for the file input. */
  accept: string;
  maxMb: number;
  files: FileView[];
  /** Files can be removed only from a draft that was never submitted. */
  canRemove: boolean;
  /** The completeness check's message for this requirement, if any. */
  error?: string;
};

/**
 * The files of one attachment requirement on the officer's form: add another file, add a new version
 * of a file, or (draft only) remove one. Each change is uploaded and saved at once.
 */
export function RequirementFiles({ requestId, requirementKey, label, isRequired, acceptedText, accept, maxMb, files, canRemove, error }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [, startRefresh] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  function choose(attachmentId: string | null) {
    target.current = attachmentId;
    input.current?.click();
  }

  async function onFile(file: File) {
    const attachmentId = target.current;
    setMessage(null);
    setBusy(attachmentId ?? "new");
    setProgress(0);
    const uploaded = await uploadRequestFile(requestId, "request", file, maxMb, setProgress);
    if (!uploaded.ok) {
      setBusy(null);
      setMessage(uploaded.message);
      return;
    }
    const saved = attachmentId ? await addVersionAction(requestId, attachmentId, uploaded.uploadId) : await attachFileAction(requestId, requirementKey, uploaded.uploadId);
    setBusy(null);
    if (!saved.ok) setMessage(saved.message ?? "تعذّر حفظ الملف.");
    else startRefresh(() => router.refresh());
  }

  const status = busy ? (
    <span className="t-caption inline-flex items-center gap-2" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      جارٍ الرفع {formatNumber(progress)}٪
    </span>
  ) : null;

  return (
    <div id={`attachment-${requirementKey}`} className={`scroll-mt-24 lg:scroll-mt-44 ${error ? "border-s-2 border-st-bad ps-4" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {label}
          {isRequired ? (
            <span className="ms-1 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
          <span className="t-caption ms-2 font-normal">{isRequired ? "مطلوب: ملف واحد على الأقل" : "اختياري"}</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => choose(null)} disabled={Boolean(busy)}>
          <FilePlus2 aria-hidden="true" strokeWidth={1.75} />
          إضافة ملف
        </Button>
      </div>
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
      {files.length === 0 ? (
        <p className="t-caption mt-2">لم يُرفق أي ملف بعد.</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {files.map((f) => (
            <FileItem
              key={f.attachmentId}
              requestId={requestId}
              file={f}
              actions={
                <>
                  <Button variant="ghost" size="sm" onClick={() => choose(f.attachmentId)} disabled={Boolean(busy)}>
                    <Upload aria-hidden="true" strokeWidth={1.75} />
                    إصدار جديد
                  </Button>
                  {canRemove ? (
                    <ConfirmDialog
                      trigger={<Trash2 aria-hidden="true" strokeWidth={1.75} />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      triggerLabel={`حذف ${f.title}`}
                      title="حذف الملف من المسودة"
                      description={<>يُحذف «<bdi>{f.title}</bdi>» وجميع إصداراته من هذه المسودة نهائيًا.</>}
                      confirmLabel="حذف الملف"
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
      )}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {status}
        {message || error ? (
          <p role="alert" className="text-xs text-danger">
            {message ?? error}
          </p>
        ) : (
          <p className="t-caption">
            الأنواع المقبولة: {acceptedText}؛ حتى {formatNumber(maxMb)} ميغابايت للملف. يمكن إرفاق أكثر من ملف، ولكل ملف إصداراته.
          </p>
        )}
      </div>
    </div>
  );
}
