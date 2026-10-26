import type { Metadata } from "next";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { FormSteps } from "@/components/requests/form-steps";
import { NewRequestForm } from "@/components/requests/new-request-form";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { newRequestOptions } from "@/server/services/requests/drafts";

export const metadata: Metadata = { title: "طلب جديد" };

export default async function NewRequestPage() {
  const user = await requireUser();
  if (!can(user.role, "requests.create")) return <ForbiddenPage />;
  const { programs, associationActive } = await newRequestOptions(user);

  return (
    <>
      <PageBand compact eyebrow={user.associationName ?? undefined} title="طلب جديد" lead="اختاروا البرنامج ثم المبادرة، ثم أكملوا بيانات الطلب ومرفقاته واحفظوه مسودة حتى تقدّموه." />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel>
            <PanelHeader title="البرنامج والمبادرة" description="الخطوة الأولى من طلب جديد" />
            <div className="px-6 pb-6">
              {!associationActive ? (
                <Alert tone="warning" title="حساب الجمعية غير نشط">
                  لا يمكن إنشاء طلبات جديدة حتى يُفعَّل حساب الجمعية. تواصلوا مع إدارة المنصة.
                </Alert>
              ) : programs.length === 0 ? (
                <EmptyState variant="inline" title="لا توجد مبادرات متاحة حاليًا" description="جميع البرامج أو المبادرات موقوفة حاليًا عن استقبال الطلبات." />
              ) : (
                <NewRequestForm programs={programs} />
              )}
            </div>
          </Panel>
          <FormSteps current={0}>
            اختاروا المبادرة الأقرب إلى برنامجكم أو مشروعكم؛ فمتطلبات الطلب ومرفقاته تُحدَّد حسب المبادرة، ويُسند الطلب إلى مشرف البرنامج المختص.
          </FormSteps>
        </div>
      </PageBody>
    </>
  );
}
