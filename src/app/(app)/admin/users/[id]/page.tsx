import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { UserAccountActions } from "@/components/admin/user-account-actions";
import { UserForm } from "@/components/admin/user-form";
import { imageUrl } from "@/lib/images";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { auditActionLabel } from "@/lib/audit-labels";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { ROLE_LABELS } from "@/server/authz/roles";
import { updateUserAction } from "@/server/actions/admin/users";
import { getUserDetail, userFormOptions } from "@/server/services/admin/users";

export const metadata: Metadata = { title: "بيانات المستخدم" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "users.manage")) return <ForbiddenPage />;
  const { id } = await params;
  const detail = await getUserDetail(user, id);
  if (!detail) notFound();
  const options = await userFormOptions(user, detail.associationId);
  const isSelf = detail.id === user.id;

  return (
    <>
      <PageBand
        compact
        eyebrow="المستخدمون"
        title={detail.name}
        lead={
          <>
            {ROLE_LABELS[detail.role]}
            {detail.association ? ` — ${detail.association.name}` : ""}
            {" · "}
            <bdi dir="ltr">{detail.username}</bdi>
          </>
        }
        actions={
          <Link href="/admin/users" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            قائمة المستخدمين
          </Link>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <Panel>
            <PanelHeader title="بيانات الحساب" description={isSelf ? "هذا حسابك." : undefined} />
            <div className="px-6 pb-6">
              <UserForm
                mode="edit"
                action={updateUserAction.bind(null, detail.id)}
                isSelf={isSelf}
                programs={options.programs}
                associations={options.associations}
                defaults={{
                  username: detail.username ?? "",
                  name: detail.name,
                  email: detail.email ?? "",
                  phone: detail.phone ?? "",
                  role: detail.role,
                  programIds: detail.programIds,
                  associationId: detail.associationId ?? "",
                  imageUrl: imageUrl("user", detail.id, detail.avatarKey),
                }}
              />
            </div>
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel>
              <PanelHeader title="حالة الحساب" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-6 pb-5 text-sm">
                <dt className="t-label">الحالة</dt>
                <dd>
                  <StatusText tone={detail.isActive ? "ok" : "neutral"}>{detail.isActive ? "نشط" : "معطل"}</StatusText>
                </dd>
                <dt className="t-label">كلمة المرور</dt>
                <dd className="text-ink-muted">{detail.mustChangePassword ? "مؤقتة، بانتظار التغيير عند أول دخول" : "عيّنها صاحب الحساب"}</dd>
                <dt className="t-label">آخر دخول</dt>
                <dd>{detail.lastLoginAt ? <DateDisplay date={detail.lastLoginAt} withTime /> : <span className="text-ink-subtle">لم يسجل الدخول</span>}</dd>
                <dt className="t-label">الجلسات النشطة</dt>
                <dd className="t-figure">{formatNumber(detail.activeSessions)}</dd>
                <dt className="t-label">تاريخ الإنشاء</dt>
                <dd>
                  <DateDisplay date={detail.createdAt} />
                </dd>
                {detail.association ? (
                  <>
                    <dt className="t-label">الجمعية</dt>
                    <dd>
                      <Link href={`/admin/associations/${detail.association.id}`} className="text-primary hover:underline">
                        {detail.association.name}
                      </Link>
                      {!detail.association.isActive ? <span className="t-caption block">الجمعية معطلة</span> : null}
                    </dd>
                  </>
                ) : null}
              </dl>
              <div className="px-6 pb-6">
                <UserAccountActions userId={detail.id} name={detail.name} isActive={detail.isActive} isSelf={isSelf} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="آخر العمليات على الحساب" />
              {detail.history.length === 0 ? (
                <p className="t-body px-6 pb-6 text-sm">لا توجد عمليات مسجلة على هذا الحساب.</p>
              ) : (
                <ol className="flex flex-col gap-3 px-6 pb-6">
                  {detail.history.map((h) => (
                    <li key={h.id} className="text-sm">
                      <p className="font-semibold text-ink">{auditActionLabel(h.action)}</p>
                      <p className="t-caption mt-0.5 flex flex-wrap gap-x-2">
                        <span>{h.actor?.name ?? "النظام"}</span>
                        <DateDisplay date={h.createdAt} withTime />
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <div className="border-t border-line px-6 py-3">
                <Link href="/admin/audit?entity=User" className="text-sm text-primary hover:underline">
                  فتح سجل التدقيق
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
