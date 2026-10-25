"use client";

import { CircleCheck, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatFileSize, formatNumber } from "@/lib/format";
import { ALLOWED_FILE_TYPES_TEXT } from "@/lib/validation/settings";

type Uploaded = { uploadId: string; fileName: string; size: number };

/**
 * Streams the chosen file to an upload route (raw body, name in x-file-name; by default
 * POST /api/admin/template-uploads) and
 * keeps only the returned upload id in a hidden input. The server checks everything again; the
 * accept list is a convenience.
 */
export function FileUploader({
  accept,
  maxMb,
  error,
  label,
  endpoint = "/api/admin/template-uploads",
}: {
  accept: string;
  maxMb: number;
  error?: string;
  label: string;
  endpoint?: string;
}) {
  const id = useId();
  const [state, setState] = useState<{ phase: "idle" | "uploading" | "done" | "failed"; progress: number; message?: string; file?: Uploaded }>({
    phase: "idle",
    progress: 0,
  });
  const [chosen, setChosen] = useState("");
  const xhr = useRef<XMLHttpRequest | null>(null);

  function upload(file: File) {
    xhr.current?.abort();
    if (file.size > maxMb * 1024 * 1024) {
      setState({ phase: "failed", progress: 0, message: `حجم الملف أكبر من الحد المسموح به (${formatNumber(maxMb)} ميغابايت).` });
      return;
    }
    const request = new XMLHttpRequest();
    xhr.current = request;
    request.open("POST", endpoint);
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.upload.onprogress = (e) => {
      if (e.lengthComputable) setState((s) => ({ ...s, phase: "uploading", progress: Math.round((e.loaded / e.total) * 100) }));
    };
    request.onload = () => {
      let body: { uploadId?: string; fileName?: string; size?: number; message?: string } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Non-JSON error page.
      }
      if (request.status === 201 && body.uploadId) {
        setState({ phase: "done", progress: 100, file: { uploadId: body.uploadId, fileName: body.fileName ?? file.name, size: body.size ?? file.size } });
      } else {
        setState({ phase: "failed", progress: 0, message: body.message ?? "تعذّر رفع الملف. أعد المحاولة." });
      }
    };
    request.onerror = () => setState({ phase: "failed", progress: 0, message: "انقطع الاتصال أثناء رفع الملف. أعد المحاولة." });
    setState({ phase: "uploading", progress: 0 });
    request.send(file);
  }

  const message = state.phase === "failed" ? state.message : error;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        <span className="ms-1 text-danger" aria-hidden="true">
          *
        </span>
      </label>
      <div className={cn("flex flex-wrap items-center gap-3 rounded-sm border px-4 py-3", message ? "border-danger" : "border-line-strong")}>
        {/* The native control is visually hidden (its button text follows the browser's language, not
            the product's); it stays focusable, and the Arabic button below is its second label. */}
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setChosen(file?.name ?? "");
            if (file) upload(file);
          }}
          aria-invalid={Boolean(message)}
          aria-describedby={`${id}-help`}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          aria-hidden="true"
          className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-line-strong bg-surface-muted px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
        >
          <Upload strokeWidth={1.75} className="size-4 text-ink-subtle" />
          اختيار ملف
        </label>
        <span className="min-w-0 truncate text-sm text-ink-muted">{chosen ? <bdi>{chosen}</bdi> : "لم يُختر ملف"}</span>
      </div>
      <input type="hidden" name="uploadId" value={state.file?.uploadId ?? ""} />
      {state.phase === "uploading" ? (
        <div className="flex items-center gap-3" role="status">
          <div className="h-1.5 flex-1 rounded-sm bg-surface-sunken">
            <div className="h-full rounded-sm bg-primary transition-all" style={{ width: `${state.progress}%` }} />
          </div>
          <span className="t-caption t-figure">{formatNumber(state.progress)}٪</span>
        </div>
      ) : null}
      {state.phase === "done" && state.file ? (
        <p className="inline-flex items-center gap-2 text-sm text-st-ok" role="status">
          <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
          رُفع «<bdi>{state.file.fileName}</bdi>» ({formatFileSize(state.file.size)}) وتحقق النظام من نوعه.
        </p>
      ) : null}
      {message ? (
        <p id={`${id}-help`} role="alert" className="text-xs text-danger">
          {message}
        </p>
      ) : (
        <p id={`${id}-help`} className="t-caption">
          {ALLOWED_FILE_TYPES_TEXT}؛ حتى {formatNumber(maxMb)} ميغابايت.
        </p>
      )}
    </div>
  );
}
