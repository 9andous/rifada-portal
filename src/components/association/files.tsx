import { Download, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { formatFileSize, formatHijri } from "@/lib/format";
import { fileHref } from "@/lib/requests";
import type { FileView } from "@/server/services/requests/read";

/**
 * One stored file on the association pages (D-102): the full name, its size and date, and a worded
 * «تنزيل» button for its current version. Earlier versions stay on the staff pages.
 */
export function FileRow({ requestId, file, actions }: { requestId: string; file: FileView; actions?: ReactNode }) {
  const current = file.current;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-muted px-4 py-3">
      <FileText aria-hidden="true" strokeWidth={1.75} className="size-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 basis-48">
        <p className="break-words text-base font-semibold text-ink">
          <bdi>{current?.fileName ?? file.title}</bdi>
        </p>
        {current ? (
          <p className="text-sm text-ink-muted">
            {formatFileSize(current.size)} · رُفع في {formatHijri(current.createdAt)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          <a href={fileHref(requestId, current.id)} download className={buttonClasses("outline", "sm")}>
            <Download aria-hidden="true" strokeWidth={1.75} />
            تنزيل
          </a>
        ) : null}
        {actions}
      </div>
    </li>
  );
}
