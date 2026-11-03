import { Download, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { DateDisplay } from "@/components/ui/date-display";
import { fileHref } from "@/lib/requests";
import { formatFileSize, formatNumber } from "@/lib/format";
import type { FileView } from "@/server/services/requests/read";

/** One stored file: its current version with a download link, and its earlier versions on demand. */
export function FileItem({ requestId, file, actions }: { requestId: string; file: FileView; actions?: ReactNode }) {
  const current = file.current;
  const older = file.versions.filter((v) => v.id !== current?.id);
  return (
    <li className="flex flex-col gap-1 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <FileText aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-subtle" />
        {current ? (
          <a href={fileHref(requestId, current.id)} className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink hover:text-primary hover:underline" download>
            <bdi className="truncate">{current.fileName}</bdi>
            <Download aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            <span className="sr-only">تنزيل</span>
          </a>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
        {current ? (
          <span className="t-caption">
            الإصدار {formatNumber(current.versionNo)} · {formatFileSize(current.size)} · {current.uploadedBy}
          </span>
        ) : null}
        {actions ? <span className="ms-auto flex items-center gap-2">{actions}</span> : null}
      </div>
      {current ? <DateDisplay date={current.createdAt} withTime className="t-caption ps-7" /> : null}
      {older.length > 0 ? (
        <details className="ps-7">
          <summary className="t-caption cursor-pointer hover:text-ink">الإصدارات السابقة ({formatNumber(older.length)})</summary>
          <ol className="mt-1 flex flex-col gap-1">
            {older.map((v) => (
              <li key={v.id} className="t-caption flex flex-wrap items-baseline gap-x-2">
                <a href={fileHref(requestId, v.id)} className="text-primary hover:underline" download>
                  الإصدار {formatNumber(v.versionNo)}: <bdi>{v.fileName}</bdi>
                </a>
                <span>{formatFileSize(v.size)}</span>
                <DateDisplay date={v.createdAt} />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </li>
  );
}
