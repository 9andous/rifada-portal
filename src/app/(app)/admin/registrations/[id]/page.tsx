import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, Download, FileText, HeartHandshake, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { InviteActions } from "@/components/registration/invite-actions";
import { InviteLink } from "@/components/registration/invite-link";
import { RegistrationDecision } from "@/components/registration/registration-decision";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Alert, HeaderDiamond, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { formatFileSize, toArabicDigits } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { REGISTRATION_STATUS } from "@/lib/registrations";
import { placeLabels, siteLabel } from "@/lib/service-places";
import {
  approveRegistrationAction,
  cancelInvitationAction,
  rejectRegistrationAction,
  renewInvitationAction,
} from "@/server/actions/registration";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getRegistration } from "@/server/services/registrations";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "طلب تسجيل جمعية" };

function Info({ label, children, ltr, wide }: { label: string; children: ReactNode; ltr?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children ? ltr ? <bdi dir="ltr">{children}</bdi> : children : <span className="text-ink-subtle">—</span>}</dd>
    </div>
  );
}

export default async function RegistrationPage({ params }: PageProps<"/admin/registrations/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "registrations.review")) return <ForbiddenPage />;
  const { id } = await params;
  const [r, defaultHours] = await Promise.all([getRegistration(user, id), getSetting("registration.inviteHours")]);
  if (!r) notFound();
  const status = REGISTRATION_STATUS[r.status];
  const invited = r.status === "INVITED";
  const legacy = Boolean(r.officerUsername);
  const places = placeLabels(r.serviceSite, r.servicePlaces);

  return (
    <>
      <PageBand
        compact
        eyebrow={
          <span className="flex items-center gap-2">
            طلبات التسجيل <span aria-hidden="true">/</span>
            <bdi dir="ltr">{r.referenceNo}</bdi>
          </span>
        }
        title={r.name}
        lead={invited ? "بانتظار أن تستكمل الجمعية بياناتها من رابط التسجيل." : [siteLabel(r.serviceSite) ?? [r.city, r.region].filter(Boolean).join("، "), r.classification].filter(Boolean).join(" · ")}
        actions={
          <>
            <StatusText tone={status.tone} className="px-3 py-1 text-sm">
              {status.label}
            </StatusText>
            <Link href={invited ? "/admin/registrations?status=INVITED" : "/admin/registrations"} className={buttonClasses("outline")}>
              <ArrowRight aria-hidden="true" strokeWidth={1.75} />
              الطلبات
            </Link>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel>
              <PanelHeader title="بيانات الجمعية" />
              <div className="flex items-center gap-4 px-6 pb-5">
                <Avatar name={r.name} src={imageUrl("registration", r.id, r.logoKey)} className="size-16 rounded-xl border border-line bg-surface text-lg [&>img]:object-contain" />
                <p className="t-caption">
                  {r.logoKey ? "شعار الجمعية المرفق بالطلب." : r.status === "APPROVED" ? "انتقل شعار الجمعية، إن وُجد، إلى ملفها بعد الاعتماد." : invited ? "ترفق الجمعية شعارها، إن وُجد، من رابط التسجيل." : "لم ترفق الجمعية شعارًا."}
                </p>
              </div>
              <dl className="grid gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2">
                <Info label="اسم الجمعية">{r.name}</Info>
                <Info label="رقم الترخيص">{toArabicDigits(r.licenseNumber)}</Info>
                <Info label="البريد الإلكتروني (اسم الدخول)" ltr>
                  {r.contactEmail}
                </Info>
                <Info label="موقع الويب" ltr>
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                      {r.website}
                    </a>
                  ) : null}
                </Info>
                <Info label="التصنيف">{r.classification}</Info>
                <Info label="سنة التأسيس">{r.foundedYear ? `${toArabicDigits(r.foundedYear)} هـ` : null}</Info>
                <Info label="هاتف الجمعية" ltr>
                  {r.contactPhone}
                </Info>
                <Info label="تاريخ الإنشاء">
                  <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                    <DateDisplay date={r.createdAt} />
                    {r.invitedBy ? <span className="t-caption">بواسطة {r.invitedBy.name}</span> : null}
                  </span>
                </Info>
              </dl>
            </Panel>

            <Panel>
              <PanelHeader title="مكان تقديم الخدمة" />
              <div className="px-6 pb-6">
                {r.serviceSite ? (
                  <>
                    <p className="flex items-center gap-2 font-semibold text-brand-ink">
                      <MapPin aria-hidden="true" className="size-4 text-primary" strokeWidth={1.75} />
                      {siteLabel(r.serviceSite)}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {places.map((p) => (
                        <li key={p} className="rounded-md border border-line bg-surface-muted px-2.5 py-1 text-sm text-ink">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">{invited ? "تختاره الجمعية من رابط التسجيل." : [r.city, r.region].filter(Boolean).join("، ") || "—"}</p>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="مسؤولا الجمعية" />
              <dl className="grid gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2">
                <Info label="المسؤول الأول">{r.officerName}</Info>
                <Info label="جوال المسؤول الأول" ltr>
                  {r.officerPhone}
                </Info>
                <Info label="المسؤول الثاني">{r.secondOfficerName}</Info>
                <Info label="جوال المسؤول الثاني" ltr>
                  {r.secondOfficerPhone}
                </Info>
                {legacy ? (
                  <>
                    <Info label="بريد المسؤول" ltr>
                      {r.officerEmail}
                    </Info>
                    <Info label="اسم المستخدم المطلوب" ltr>
                      {r.officerUsername}
                    </Info>
                  </>
                ) : null}
              </dl>
            </Panel>

            <Panel>
              <PanelHeader title="الخطاب" />
              <div className="px-6 pb-6">
                {r.letterKey ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                      <span className="min-w-0">
                        <bdi className="block truncate text-sm font-semibold text-ink">{r.letterFileName}</bdi>
                        {r.letterSize ? <span className="t-caption">{formatFileSize(r.letterSize)}</span> : null}
                      </span>
                    </span>
                    <a href={`/api/admin/registrations/${r.id}/letter`} className={buttonClasses("outline", "sm")}>
                      <Download aria-hidden="true" strokeWidth={1.75} />
                      تنزيل
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">{invited ? "ترفقه الجمعية من رابط التسجيل." : "لم يُرفق خطاب بهذا الطلب."}</p>
                )}
              </div>
            </Panel>
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-[168px]">
            {invited && r.inviteToken ? (
              <Panel className="overflow-hidden">
                <div className="flex items-start gap-3 border-b border-line bg-accent-soft/50 px-5 py-3.5">
                  <HeaderDiamond />
                  <h2 className="t-section">رابط التسجيل</h2>
                </div>
                <div className="flex flex-col gap-4 p-5">
                  <p className="text-sm leading-relaxed text-ink-muted">أرسل الرابط إلى الجمعية. يتعطل بانتهاء صلاحيته أو بعد إرسال الجمعية بياناتها.</p>
                  <InviteLink token={r.inviteToken} expiresAt={r.inviteExpiresAt?.toISOString() ?? null} />
                  <InviteActions renew={renewInvitationAction.bind(null, r.id)} cancel={cancelInvitationAction.bind(null, r.id)} defaultHours={defaultHours} />
                </div>
              </Panel>
            ) : null}

            {invited ? null : (
              <Panel className="overflow-hidden">
                <div className="flex items-start gap-3 border-b border-line bg-primary-soft/50 px-5 py-3.5">
                  <HeaderDiamond />
                  <h2 className="t-section">القرار</h2>
                </div>
                <div className="p-5">
                  <RegistrationDecision
                    name={r.name}
                    email={legacy ? null : r.contactEmail}
                    canDecide={r.status === "PENDING"}
                    approve={approveRegistrationAction.bind(null, r.id)}
                    reject={rejectRegistrationAction.bind(null, r.id)}
                    decided={
                      <div className="flex flex-col gap-3 text-sm">
                        <StatusText tone={status.tone}>{status.label}</StatusText>
                        <p className="text-ink-muted">
                          بواسطة {r.reviewedBy?.name ?? "—"} · <DateDisplay date={r.reviewedAt} className="t-caption" />
                        </p>
                        {r.decisionNote ? (
                          <Alert tone={r.status === "REJECTED" ? "warning" : "info"} title={r.status === "REJECTED" ? "السبب" : "ملاحظة"}>
                            {r.decisionNote}
                          </Alert>
                        ) : null}
                        {r.associationId ? (
                          <Link href={`/admin/associations/${r.associationId}`} className={buttonClasses("outline", "md", "w-full")}>
                            <Building2 aria-hidden="true" strokeWidth={1.75} />
                            ملف الجمعية
                          </Link>
                        ) : null}
                      </div>
                    }
                  />
                </div>
              </Panel>
            )}

            {r.pledgeAcceptedAt ? (
              <Panel className="p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <HeartHandshake aria-hidden="true" className="size-5 text-accent-ink" strokeWidth={1.75} />
                  التعهد
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  تعهّدت الجمعية بالالتزام بقيم الرئاسة وصحة البيانات في <DateDisplay date={r.pledgeAcceptedAt} className="t-caption" />.
                </p>
                <p className="t-caption mt-3">
                  أُرسل الطلب في <DateDisplay date={r.submittedAt ?? r.createdAt} />
                </p>
              </Panel>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
