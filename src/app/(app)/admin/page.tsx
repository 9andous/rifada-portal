import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CircleCheck, Clock, History, Hourglass, Inbox, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { BandDate } from "@/components/dashboard/band-date";
import { ProgramsCard, TracksCard } from "@/components/dashboard/cards";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { KpiRow } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { auditActionLabel } from "@/lib/audit-labels";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { ROLE_LABELS, ROLES } from "@/server/authz/roles";
import { db } from "@/server/db";
import { getByProgram, getByTrack, getOverview } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "إدارة النظام" };

const REQUESTS = "/admin/requests";

export default async function AdminDashboard() {
  const user = await requireUser();
  const now = new Date();
  const [overview, usersByRole, associations, recentAudit, byProgram, byTrack] = await Promise.all([
    getOverview(user, now),
    db.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
    db.association.count({ where: { isActive: true } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } },
    }),
    getByProgram(user),
    getByTrack(user),
  ]);
  const roleCount = (role: string) => usersByRole.find((r) => r.role === role)?._count._all ?? 0;
  const totalUsers = usersByRole.reduce((sum, r) => sum + r._count._all, 0);

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="إدارة النظام"
        lead="مؤشرات المنصة كاملة: الطلبات في جميع البرامج، والجمعيات والحسابات، وآخر العمليات المسجلة."
        actions={<BandDate date={now} />}
        figures={
          // Platform-wide figures (owner's review, D-132), not the reference-data counts.
          <KpiRow
            items={[
              { label: "إجمالي الطلبات", icon: Inbox, featured: true, value: formatNumber(overview.total), caption: "في جميع البرامج", href: REQUESTS },
              {
                label: "قيد المراجعة",
                icon: Hourglass,
                tone: "review",
                value: formatNumber(overview.underReview),
                caption: `ومعادة للتعديل: ${formatNumber(overview.returned)}`,
                href: `${REQUESTS}?status=UNDER_REVIEW`,
              },
              {
                label: "متأخرة عن المهلة",
                icon: Clock,
                tone: "bad",
                alert: overview.overdue > 0,
                value: formatNumber(overview.overdue),
                caption: "تجاوزت مهلة المراجعة",
                href: `${REQUESTS}?overdue=1`,
              },
              {
                label: "مقبولة",
                icon: CircleCheck,
                tone: "ok",
                value: formatNumber(overview.approved),
                caption: overview.rejected ? `وغير معتمدة: ${formatNumber(overview.rejected)}` : "طلبات صدر اعتمادها",
                href: `${REQUESTS}?status=APPROVED`,
              },
              { label: "الجمعيات النشطة", icon: Building2, value: formatNumber(associations), caption: "المسجلة في المنصة", href: "/admin/associations" },
              { label: "المستخدمون النشطون", icon: Users, value: formatNumber(totalUsers), caption: "في جميع الأدوار", href: "/admin/users" },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {/* The requests per programme and per track, as on the unit manager's home (owner's request). */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          <ProgramsCard rows={byProgram} hrefBase={REQUESTS} />
          <TracksCard data={byTrack} tracksHref="/admin/taxonomy/tracks" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Panel>
            <PanelHeader title="المستخدمون حسب الدور" description="الحسابات النشطة" />
            <DonutChart totalLabel="حسابًا نشطًا" slices={ROLES.map((role) => ({ label: ROLE_LABELS[role], value: roleCount(role) }))} />
          </Panel>

          <Panel>
            <PanelHeader
              title="آخر العمليات المسجلة"
              description="من سجل التدقيق"
              actions={
                <Link href="/admin/audit" className={buttonClasses("outline", "sm")}>
                  السجل كاملًا
                </Link>
              }
            />
            {recentAudit.length === 0 ? (
              <div className="mx-6 mb-6 flex items-start gap-4 rounded-lg border border-line bg-surface-muted p-4">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted [&_svg]:size-5">
                  <History strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-bold">لا توجد عمليات مسجلة بعد</p>
                  <p className="t-caption mt-0.5 text-sm">تُسجَّل هنا عمليات الدخول وتعديل البيانات فور حدوثها.</p>
                </div>
              </div>
            ) : (
              <ul className="-mt-5">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line/70 px-6 py-3 text-sm last:border-0 hover:bg-surface-muted">
                    <span className="flex items-center gap-3">
                      <Avatar name={entry.actor?.name ?? "النظام"} size="sm" />
                      <span>
                        <span className="font-semibold">{entry.actor?.name ?? "النظام"}</span>
                        <span className="mx-2 text-ink-subtle">·</span>
                        <span className="text-ink-muted">{auditActionLabel(entry.action)}</span>
                      </span>
                    </span>
                    <DateDisplay date={entry.createdAt} withTime className="t-caption" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
