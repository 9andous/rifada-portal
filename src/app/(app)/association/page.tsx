import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOverview } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "طلباتي" };

export default async function AssociationDashboard() {
  const user = await requireUser();
  const now = new Date();
  const overview = await getOverview(user, now);

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title={user.associationName ?? "طلبات الجمعية"}
        lead="متابعة طلبات جمعيتكم المقدمة إلى الوحدة الإشرافية ومراحل مراجعتها."
        actions={<BandDate date={now} />}
        figures={
          <BandFigures
            items={[
              {
                label: "الطلبات المقدَّمة",
                value: formatNumber(overview.total),
                caption: overview.drafts ? `مسودات غير مقدَّمة: ${formatNumber(overview.drafts)}` : "لا توجد مسودات",
              },
              { label: "قيد المراجعة", value: formatNumber(overview.underReview), caption: "لدى الوحدة الإشرافية" },
              { label: "معادة للتعديل", value: formatNumber(overview.returned), caption: "بانتظار تعديلكم", emphasis: true },
              { label: "معتمدة", value: formatNumber(overview.approved), caption: "منذ تسجيل الجمعية" },
            ]}
          />
        }
      />
      <PageBody>
        <Panel>
          <PanelHeader title="طلبات الجمعية" />
          {overview.total + overview.drafts === 0 ? (
            <EmptyState
              variant="inline"
              icon={<FilePlus2 strokeWidth={1.75} />}
              title="لم تقدّموا أي طلب بعد"
              description="يمكنكم تقديم طلب برنامج أو مشروع ضمن برامج الرئاسة، وستظهر هنا حالته ومراحل مراجعته."
              action={
                <Link href="/association/requests/new" className={buttonClasses("primary")}>
                  طلب جديد
                </Link>
              }
            />
          ) : (
            <p className="t-body px-6 pb-6">
              <Link href="/association/requests" className="font-semibold text-primary hover:underline">
                عرض جميع طلبات الجمعية ومسوداتها
              </Link>
            </p>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
