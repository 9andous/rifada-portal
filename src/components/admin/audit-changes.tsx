import type { Prisma } from "@/generated/prisma/client";
import { SETTING_LABELS, auditFieldLabel } from "@/lib/audit-labels";
import { formatNumber } from "@/lib/format";
import { isRole, ROLE_LABELS } from "@/server/authz/roles";

type Json = Prisma.JsonValue;

function isObject(v: Json): v is Prisma.JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function display(field: string, value: Json | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return formatNumber(value);
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((v) => display(field, v)).join("، ");
  if (typeof value === "string") {
    if (field === "role" && isRole(value)) return ROLE_LABELS[value];
    if (field === "key") return SETTING_LABELS[value] ?? value;
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Before/after of an audit entry as label-value rows; changed fields first and marked.
 * Snapshots never hold secrets (they are allow-listed and redacted when written).
 */
export function AuditChanges({ before, after }: { before: Json; after: Json }) {
  const b = isObject(before) ? before : {};
  const a = isObject(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (keys.length === 0) return <p className="t-caption">لا توجد تفاصيل إضافية لهذه العملية.</p>;
  const hasBefore = isObject(before);
  const rows = keys
    .map((k) => ({ k, changed: JSON.stringify(b[k]) !== JSON.stringify(a[k]) }))
    .sort((x, y) => Number(y.changed) - Number(x.changed));

  return (
    <table className="t-table w-full max-w-3xl border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className="t-label w-48 py-1.5 text-start">
            الحقل
          </th>
          {hasBefore ? (
            <th scope="col" className="t-label py-1.5 text-start">
              قبل
            </th>
          ) : null}
          <th scope="col" className="t-label py-1.5 text-start">
            {hasBefore ? "بعد" : "القيمة"}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ k, changed }) => (
          <tr key={k} className="border-t border-line">
            <th scope="row" className="py-1.5 pe-4 text-start font-medium text-ink-muted">
              {auditFieldLabel(k)}
            </th>
            {hasBefore ? <td className="py-1.5 pe-4 text-ink-muted">{display(k, b[k])}</td> : null}
            <td className={changed && hasBefore ? "py-1.5 font-semibold text-ink" : "py-1.5 text-ink"}>
              {display(k, a[k])}
              {changed && hasBefore ? <span className="sr-only"> (تغيّر)</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
