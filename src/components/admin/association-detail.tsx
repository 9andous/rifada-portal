import Link from "next/link";
import type { ReactNode } from "react";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { AssociationDetail } from "@/server/services/admin/associations";

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children ?? <span className="text-ink-subtle">—</span>}</dd>
    </div>
  );
}

/** Read-only label-over-value view of an association (the unit manager's detail page). */
export function AssociationSummary({ association }: { association: AssociationDetail }) {
  return (
    <Panel>
      <PanelHeader title="بيانات الجمعية" />
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
        <Pair label="اسم الجمعية">{association.name}</Pair>
        <Pair label="رقم الترخيص">{association.licenseNumber ? <bdi dir="ltr">{toArabicDigits(association.licenseNumber)}</bdi> : null}</Pair>
        <Pair label="التصنيف">{association.classification}</Pair>
        <Pair label="المدينة">{association.city}</Pair>
        <Pair label="المنطقة">{association.region}</Pair>
        <Pair label="مسؤول التواصل">{association.contactName}</Pair>
        <Pair label="البريد الإلكتروني">{association.contactEmail ? <bdi dir="ltr">{association.contactEmail}</bdi> : null}</Pair>
        <Pair label="الهاتف">{association.contactPhone ? <bdi dir="ltr">{toArabicDigits(association.contactPhone)}</bdi> : null}</Pair>
      </dl>
    </Panel>
  );
}

/** Status, officer account and request count. The officer link is shown only to the super admin. */
export function AssociationStatusPanel({
  association,
  linkOfficer,
  requestsHref,
  children,
}: {
  association: AssociationDetail;
  linkOfficer: boolean;
  /** The association's submitted requests in the viewer's request list. */
  requestsHref?: string;
  children?: ReactNode;
}) {
  const officer = association.officer;
  return (
    <Panel>
      <PanelHeader title="الحالة والحساب" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-6 pb-5 text-sm">
        <dt className="t-label">الحالة</dt>
        <dd>
          <StatusText tone={association.isActive ? "ok" : "neutral"}>{association.isActive ? "نشطة" : "معطلة"}</StatusText>
        </dd>
        <dt className="t-label">حساب المسؤول</dt>
        <dd>
          {officer ? (
            <>
              {linkOfficer ? (
                <Link href={`/admin/users/${officer.id}`} className="text-primary hover:underline">
                  {officer.name}
                </Link>
              ) : (
                officer.name
              )}
              <span className="t-caption block">
                <bdi dir="ltr">{officer.username}</bdi>
                {" · "}
                {officer.isActive ? (officer.mustChangePassword ? "بانتظار تغيير كلمة المرور" : "نشط") : "معطل"}
              </span>
            </>
          ) : (
            <span className="text-ink-subtle">لا يوجد حساب</span>
          )}
        </dd>
        {officer ? (
          <>
            <dt className="t-label">آخر دخول</dt>
            <dd>{officer.lastLoginAt ? <DateDisplay date={officer.lastLoginAt} withTime /> : <span className="text-ink-subtle">لم يسجل الدخول</span>}</dd>
          </>
        ) : null}
        <dt className="t-label">الطلبات المقدمة</dt>
        <dd className="t-figure">
          {requestsHref && association.submittedRequests > 0 ? (
            <Link href={requestsHref} className="text-primary hover:underline">
              {formatNumber(association.submittedRequests)}
            </Link>
          ) : (
            formatNumber(association.submittedRequests)
          )}
        </dd>
        <dt className="t-label">تاريخ التسجيل</dt>
        <dd>
          <DateDisplay date={association.createdAt} />
        </dd>
      </dl>
      {children ? <div className="px-6 pb-6">{children}</div> : null}
    </Panel>
  );
}
