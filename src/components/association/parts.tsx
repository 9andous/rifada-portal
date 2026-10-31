import { ArrowLeft, ArrowRight, Eye, PenLine } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { RefNumber } from "@/components/ui/ref-number";
import { StatusText } from "@/components/ui/surface";
import { statusHelp, TURN_LABEL } from "@/lib/association-status";
import { cn } from "@/lib/cn";
import { formatHijri, formatNumber } from "@/lib/format";
import type { RequestRow } from "@/server/services/requests/read";

// Shared parts of the association pages (D-102): the platform's own look, with the facts an
// officer needs spelled out (the official status, the next step and whose turn it is) and one
// worded button per request. Sizes follow the design system; the area's larger root size scales them.

const detailHref = (id: string) => `/association/requests/${id}`;
const editHref = (id: string) => `/association/requests/${id}/edit`;

/** «العودة إلى …» as a button in the page head. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonClasses("outline")}>
      <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

/** The next step of a request in a few words, and whose turn it is. */
export function NextStep({ statusKey }: { statusKey: string }) {
  const help = statusHelp(statusKey);
  return (
    <span className="block">
      <span className="block font-semibold text-ink">{help.next}</span>
      {help.turn !== "none" ? (
        <span className={cn("mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold", help.turn === "association" ? "text-st-warn" : "text-ink-subtle")}>
          <span aria-hidden="true" className={cn("size-2 rounded-full", help.turn === "association" ? "bg-st-warn" : "bg-ink-subtle/60")} />
          {TURN_LABEL[help.turn]}
        </span>
      ) : null}
    </span>
  );
}

/** The one button a request needs: continue a draft, correct a returned request, or open it. */
export function RequestAction({ r, block }: { r: Pick<RequestRow, "id" | "status">; block?: boolean }) {
  // `block`: full width in a narrow list, its own width once the entry has room beside it.
  const width = block ? "w-full shrink-0 @2xl:w-auto" : undefined;
  if (r.status.key === "DRAFT") {
    return (
      <Link href={editHref(r.id)} className={buttonClasses("gold", "md", width)}>
        <PenLine aria-hidden="true" strokeWidth={1.75} />
        إكمال الطلب
      </Link>
    );
  }
  if (r.status.key === "RETURNED") {
    return (
      <Link href={editHref(r.id)} className={buttonClasses("gold", "md", width)}>
        <PenLine aria-hidden="true" strokeWidth={1.75} />
        تعديل الطلب
      </Link>
    );
  }
  return (
    <Link href={detailHref(r.id)} className={buttonClasses("outline", "md", width)}>
      <Eye aria-hidden="true" strokeWidth={1.75} />
      عرض الطلب
    </Link>
  );
}

const TH = "px-4 py-3 text-start text-[0.9375rem] font-bold whitespace-nowrap text-ink first:ps-6 last:pe-6";
const TD = "px-4 py-4 align-middle first:ps-6 last:pe-6";

/**
 * The association's requests: the title with its number and programme, the date sent, the official
 * status, the next step with whose turn it is, and the one button. A table where it has room and a
 * list otherwise; the switch is a container query in rem, so it follows the chosen text size (a
 * larger size switches to the list sooner) and not only the screen's width.
 */
export function AssocRequestsTable({ rows, caption }: { rows: RequestRow[]; caption: string }) {
  return (
    <div className="@container" data-table>
      <div className="hidden overflow-x-auto @5xl:block">
        <table className="w-full text-base">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-y border-line bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>
                الطلب
              </th>
              <th scope="col" className={TH}>
                تاريخ الإرسال
              </th>
              <th scope="col" className={TH}>
                الحالة
              </th>
              <th scope="col" className={TH}>
                الخطوة التالية
              </th>
              <th scope="col" className={cn(TH, "relative")}>
                <span className="sr-only">الإجراء</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("border-b border-line/70 last:border-0", r.status.key === "RETURNED" ? "bg-st-warn-soft/40" : "hover:bg-surface-muted")}>
                <td className={cn(TD, "min-w-64")}>
                  <Link href={detailHref(r.id)} className="font-semibold text-ink hover:text-primary hover:underline">
                    {r.title || "طلب بلا عنوان"}
                  </Link>
                  <span className="mt-0.5 block text-sm text-ink-muted">
                    {r.referenceNo ? (
                      <>
                        <RefNumber value={r.referenceNo} className="font-semibold text-primary" /> ·{" "}
                      </>
                    ) : null}
                    {r.track?.name ?? ""}
                  </span>
                </td>
                <td className={cn(TD, "whitespace-nowrap text-ink-muted")}>{r.submittedAt ? formatHijri(r.submittedAt) : "لم يُرسل بعد"}</td>
                <td className={TD}>
                  <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
                </td>
                <td className={TD}>
                  <NextStep statusKey={r.status.key} />
                </td>
                <td className={cn(TD, "text-end")}>
                  <RequestAction r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col @5xl:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0 @2xl:flex-row @2xl:items-center @2xl:gap-8 @2xl:px-6",
              r.status.key === "RETURNED" && "bg-st-warn-soft/40",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
                <span className="text-sm text-ink-muted">{r.referenceNo ? <RefNumber value={r.referenceNo} /> : "مسودة"}</span>
              </div>
              <Link href={detailHref(r.id)} className="text-lg font-bold leading-snug text-ink">
                {r.title || "طلب بلا عنوان"}
              </Link>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
                <dt className="text-ink-muted">المسار</dt>
                <dd className="text-ink">{r.track?.name ?? "—"}</dd>
                <dt className="text-ink-muted">تاريخ الإرسال</dt>
                <dd className="text-ink">{r.submittedAt ? formatHijri(r.submittedAt) : "لم يُرسل بعد"}</dd>
                <dt className="text-ink-muted">الخطوة التالية</dt>
                <dd>
                  <NextStep statusKey={r.status.key} />
                </dd>
              </dl>
            </div>
            <RequestAction r={r} block />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** «الصفحة السابقة» and «الصفحة التالية» in words, with the page number between them. */
export function ListPager({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="صفحات القائمة" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClasses("outline")}>
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          الصفحة السابقة
        </Link>
      ) : (
        <span />
      )}
      <span className="text-base text-ink-muted">
        الصفحة {formatNumber(page)} من {formatNumber(pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClasses("outline")}>
          الصفحة التالية
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
