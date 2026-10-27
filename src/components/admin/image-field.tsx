"use client";

import { Building2, ImageUp, LoaderCircle, Trash2, Undo2, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { IMAGE_ACCEPT, IMAGE_MAX_MB, initials } from "@/lib/images";

/**
 * Optional picture for a user or logo for an association. The file streams to the image upload
 * route as soon as it is chosen; the form then posts only `image.uploadId` (or `image.remove`).
 * Without a picture the preview shows the initials of the name typed in `nameFieldId`.
 */
export function ImageField({
  label,
  currentUrl,
  nameFieldId,
  defaultName = "",
  shape = "circle",
  layout = "inline",
  error,
}: {
  label: string;
  currentUrl?: string | null;
  /** The form's name input, read live for the initials placeholder. */
  nameFieldId: string;
  defaultName?: string;
  shape?: "circle" | "square";
  /** `stacked`: a large picture with its buttons centred below, for a form's profile column. */
  layout?: "inline" | "stacked";
  error?: string;
}) {
  const inputId = useId();
  const [name, setName] = useState(defaultName);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState("");
  const [removed, setRemoved] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Follow the name field so the placeholder letters match what is being typed.
  useEffect(() => {
    const field = document.getElementById(nameFieldId) as HTMLInputElement | null;
    if (!field) return;
    const sync = () => setName(field.value);
    sync();
    field.addEventListener("input", sync);
    return () => field.removeEventListener("input", sync);
  }, [nameFieldId]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function upload(file: File) {
    setMessage(null);
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) {
      setPhase("failed");
      setMessage(`حجم الصورة أكبر من ${formatNumber(IMAGE_MAX_MB)} ميغابايت.`);
      return;
    }
    const local = URL.createObjectURL(file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/image-uploads");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.onload = () => {
      let body: { uploadId?: string; message?: string } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Non-JSON error page.
      }
      if (request.status === 201 && body.uploadId) {
        setPreview(local);
        setUploadId(body.uploadId);
        setRemoved(false);
        setPhase("idle");
      } else {
        URL.revokeObjectURL(local);
        setPhase("failed");
        setMessage(body.message ?? "تعذّر رفع الصورة. أعد المحاولة.");
      }
    };
    request.onerror = () => {
      URL.revokeObjectURL(local);
      setPhase("failed");
      setMessage("انقطع الاتصال أثناء رفع الصورة. أعد المحاولة.");
    };
    setPhase("uploading");
    request.send(file);
  }

  function clear() {
    setPreview(null);
    setUploadId("");
    setRemoved(Boolean(currentUrl));
    if (fileRef.current) fileRef.current.value = "";
  }

  const shown = preview ?? (removed ? null : (currentUrl ?? null));
  const problem = message ?? error;
  const round = shape === "circle" ? "rounded-full" : "rounded-2xl";
  const stacked = layout === "stacked";
  const PlaceholderIcon = shape === "square" ? Building2 : UserRound;

  return (
    <div className={cn("flex flex-col gap-2", stacked && "items-center text-center")}>
      <span className="text-sm font-semibold text-ink">
        {label} <span className="font-normal text-ink-subtle">(اختياري)</span>
      </span>
      <div className={cn("flex flex-wrap items-center gap-4", stacked && "flex-col gap-3")}>
        <span
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden border-2 bg-band font-bold text-band-gold",
            stacked ? "size-28 text-[2rem] ring-4 ring-band-gold/15" : "size-20 text-2xl",
            round,
            problem ? "border-danger" : "border-band-gold/50",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview or a private, signed-in-only image
            <img src={shown} alt="" className="size-full object-cover" />
          ) : name.trim() ? (
            <span aria-hidden="true">{initials(name, shape === "square" ? "association" : "person")}</span>
          ) : (
            <PlaceholderIcon aria-hidden="true" className={stacked ? "size-11" : "size-8"} strokeWidth={1.5} />
          )}
          {phase === "uploading" ? (
            <span className="absolute inset-0 flex items-center justify-center bg-band/70">
              <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-band-gold" />
            </span>
          ) : null}
        </span>
        <div className={cn("flex flex-col gap-1.5", stacked && "items-center")}>
          <div className={cn("flex flex-wrap gap-2", stacked && "justify-center")}>
            <input
              ref={fileRef}
              id={inputId}
              type="file"
              accept={IMAGE_ACCEPT}
              className="peer sr-only"
              aria-invalid={Boolean(problem)}
              aria-describedby={`${inputId}-help`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
            >
              <ImageUp aria-hidden="true" className="size-4 text-primary" strokeWidth={1.75} />
              {shown ? "تغيير الصورة" : "رفع صورة"}
            </label>
            {shown ? (
              <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-danger hover:bg-danger/10">
                <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                إزالة
              </button>
            ) : removed ? (
              <button type="button" onClick={() => setRemoved(false)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink-muted hover:bg-surface-muted">
                <Undo2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                التراجع عن الإزالة
              </button>
            ) : null}
          </div>
          <p id={`${inputId}-help`} role={problem ? "alert" : undefined} className={cn("text-xs", problem ? "text-danger" : "text-ink-subtle")}>
            {problem ??
              (stacked
                ? `PNG أو JPEG أو WebP، حتى ${formatNumber(IMAGE_MAX_MB)} ميغابايت.`
                : `PNG أو JPEG أو WebP، حتى ${formatNumber(IMAGE_MAX_MB)} ميغابايت. بلا صورة تظهر الحروف الأولى من الاسم.`)}
          </p>
        </div>
      </div>
      <input type="hidden" name="image.uploadId" value={uploadId} />
      {removed && !uploadId ? <input type="hidden" name="image.remove" value="on" /> : null}
    </div>
  );
}
