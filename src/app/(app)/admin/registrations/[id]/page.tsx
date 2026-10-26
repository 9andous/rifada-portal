import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, HeartHandshake } from "lucide-react";
import type { ReactNode } from "react";
import { ProgramIcon } from "@/components/brand/program-icon";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { RegistrationDecision } from "@/components/registration/registration-decision";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Alert, HeaderDiamond, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { toArabicDigits } from "@/lib/format";
import { REGISTRATION_STATUS } from "@/lib/registrations";
import { approveRegistrationAction, rejectRegistrationAction } from "@/server/actions/registration";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getRegistration } from "@/server/services/registrations";

export const metadata: Metadata = { title: "طلب تسجيل جمعية" };

function Info({ label, children, ltr }: { label: string; children: ReactNode; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={ltr ? "mt-0.5 text-end text-sm font-semibold text-ink" : "mt-0.5 text-sm font-semibold text-ink"} dir={ltr ? "ltr" : undefined}>
        {children ?? <span className="text-ink-subtle">—</span>}
      </dd>
    </div>
  );
}

export default async function RegistrationPage({ params }: PageProps<"/admin/registrations/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "registrations.review")) return <ForbiddenPage />;
  const { id } = await params;
  const r = await getRegistration(user, id);
  if (!r) notFound();
  const status = REGISTRATION_STATUS[r.status];

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
        lead={`${r.classification} · ${r.city}، ${r.region}`}
        actions={
          <>
            <StatusText tone={status.tone} className="px-3 py-1 text-sm">
              {status.label}
            </StatusText>
            <Link href="/admin/registrations" className={buttonClasses("outline")}>
              <ArrowRight aria-hidden="true" strokeWidth={1.75} />
              الطلبات
            </Link>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel>
              <PanelHeader title="بيانات الجمعية" />
              <dl className="grid gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2">
                <Info label="اسم الجمعية">{r.name}</Info>
                <Info label="رقم الترخيص">{toArabicDigits(r.licenseNumber)}</Info>
                <Info label="التصنيف">{r.classification}</Info>
                <Info label="سنة التأسيس">{r.foundedYear ? `${toArabicDigits(r.foundedYear)} هـ` : null}</Info>
                <Info label="المنطقة">{r.region}</Info>
                <Info label="المدينة">{r.city}</Info>
                <Info label="هاتف الجمعية" ltr>
                  {r.contactPhone}
                </Info>
                <Info label="البريد الرسمي" ltr>
                  {r.contactEmail}
                </Info>
                <Info label="الموقع الإلكتروني" ltr>
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                      {r.website}
                    </a>
                  ) : null}
                </Info>
              </dl>
            </Panel>

            <Panel>
              <PanelHeader title="مجالات العمل" description="برامج الرئاسة التي اختارتها الجمعية" />
              <ul className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
                {r.programs.map((p) => (
                  <li key={p.number} className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary [&_svg]:size-5">
                      <ProgramIcon number={p.number} />
                    </span>
                    <span>
                      <span className="block text-xs text-accent-ink">البرنامج {toArabicDigits(p.number)}</span>
                      <span className="block text-sm font-bold">{p.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader title="مسؤول الجمعية والحساب" />
              <dl className="grid gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2">
                <Info label="الاسم">{r.officerName}</Info>
                <Info label="رقم الهوية">{r.officerNationalId ? toArabicDigits(r.officerNationalId) : null}</Info>
                <Info label="الجوال" ltr>
                  {r.officerPhone}
                </Info>
                <Info label="البريد" ltr>
                  {r.officerEmail}
                </Info>
                <Info label="اسم المستخدم المطلوب" ltr>
                  {r.officerUsername}
                </Info>
              </dl>
            </Panel>
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-[168px]">
            <Panel className="overflow-hidden">
              <div className="flex items-start gap-3 border-b border-line bg-primary-soft/50 px-5 py-3.5">
                <HeaderDiamond />
                <h2 className="t-section">القرار</h2>
              </div>
              <div className="p-5">
                {r.status === "PENDING" ? (
                  <>
                    <p className="mb-4 text-sm leading-relaxed text-ink-muted">تحقّقوا من رقم الترخيص وبيانات المسؤول قبل الاعتماد.</p>
                    <RegistrationDecision name={r.name} approve={approveRegistrationAction.bind(null, r.id)} reject={rejectRegistrationAction.bind(null, r.id)} />
                  </>
                ) : (
                  <div className="flex flex-col gap-3 text-sm">
                    <StatusText tone={status.tone}>{status.label}</StatusText>
                    <p className="text-ink-muted">
                      بواسطة {r.reviewedBy?.name ?? "—"} · <DateDisplay date={r.reviewedAt} withTime className="t-caption" />
                    </p>
                    {r.decisionNote ? <Alert tone={r.status === "REJECTED" ? "warning" : "info"} title={r.status === "REJECTED" ? "سبب الرفض" : "ملاحظة"}>{r.decisionNote}</Alert> : null}
                    {r.associationId ? (
                      <Link href={`/admin/associations/${r.associationId}`} className={buttonClasses("outline", "md", "w-full")}>
                        <Building2 aria-hidden="true" strokeWidth={1.75} />
                        ملف الجمعية
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </Panel>
            <Panel className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <HeartHandshake aria-hidden="true" className="size-5 text-accent-ink" strokeWidth={1.75} />
                التعهد
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                تعهّد مقدم الطلب بالالتزام بقيم الرئاسة وصحة البيانات في <DateDisplay date={r.pledgeAcceptedAt} withTime className="t-caption" />.
              </p>
              <p className="t-caption mt-3">
                قُدِّم الطلب في <DateDisplay date={r.createdAt} />
              </p>
            </Panel>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
