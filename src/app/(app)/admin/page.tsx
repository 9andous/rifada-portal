import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { BandDate } from "@/components/dashboard/band-date";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { auditActionLabel } from "@/lib/audit-labels";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { ROLE_LABELS, ROLES } from "@/server/authz/roles";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "إدارة النظام" };

export default async function AdminDashboard() {
  const user = await requireUser();
  const now = new Date();
  const [usersByRole, associations, programs, initiatives, objectives, recentAudit] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
    db.association.count({ where: { isActive: true } }),
    db.program.count({ where: { archivedAt: null } }),
    db.initiative.count({ where: { archivedAt: null } }),
    db.strategicObjective.count({ where: { archivedAt: null } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);
  const roleCount = (role: string) => usersByRole.find((r) => r.role === role)?._count._all ?? 0;
  const totalUsers = usersByRole.reduce((sum, r) => sum + r._count._all, 0);
  const maxRole = Math.max(1, ...ROLES.map(roleCount));

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="إدارة النظام"
        lead="حالة الحسابات والبيانات المرجعية وآخر العمليات المسجلة."
        actions={<BandDate date={now} />}
        figures={
          <BandFigures
            items={[
              { label: "المستخدمون النشطون", value: formatNumber(totalUsers), caption: "في جميع الأدوار", href: "/admin/users" },
              { label: "الجمعيات النشطة", value: formatNumber(associations), caption: "حساب واحد لكل جمعية", href: "/admin/associations" },
              { label: "البرامج", value: formatNumber(programs), caption: `المبادرات: ${formatNumber(initiatives)}`, href: "/admin/taxonomy" },
              { label: "الأهداف الإستراتيجية", value: formatNumber(objectives), caption: "من إستراتيجية الرئاسة", href: "/admin/taxonomy/objectives" },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Panel>
            <PanelHeader title="المستخدمون حسب الدور" description="الحسابات النشطة" />
            <ul className="flex flex-col gap-4 px-6 pb-6">
              {ROLES.map((role) => (
                <li key={role} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-4 text-sm">
                  <span className="text-ink-muted">{ROLE_LABELS[role]}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-chart-track">
                    <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(roleCount(role) / maxRole) * 100}%` }} />
                  </span>
                  <span className="t-figure text-end">{formatNumber(roleCount(role))}</span>
                </li>
              ))}
            </ul>
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
                  <p className="t-caption mt-0.5 text-[0.8125rem]">تُسجَّل هنا عمليات الدخول وتعديل البيانات فور حدوثها.</p>
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
