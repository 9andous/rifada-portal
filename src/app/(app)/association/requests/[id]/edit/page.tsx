import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { FormSteps } from "@/components/requests/form-steps";
import { DiscardDraftButton } from "@/components/requests/request-actions";
import { RequestForm } from "@/components/requests/request-form";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { RefNumber } from "@/components/ui/ref-number";
import { Alert, Panel, StatusText } from "@/components/ui/surface";
import { acceptedGroups } from "@/lib/completeness";
import { arabicList, toArabicDigits } from "@/lib/format";
import { acceptAttribute } from "@/lib/uploads";
import { UPLOAD_GROUP_LABELS } from "@/lib/validation/settings";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getRequestDetail } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "بيانات الطلب" };

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditRequestPage({ params }: PageProps<"/association/requests/[id]/edit">) {
  const user = await requireUser();
  if (!can(user.role, "requests.editDraft")) return <ForbiddenPage />;
  const { id } = await params;
  const [request, maxMb, allowedGroups] = await Promise.all([getRequestDetail(user, id), getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);
  if (!request) notFound();
  const returned = request.status.key === "RETURNED";
  const back = `/association/requests/${id}`;

  if (!request.capabilities.canEdit) {
    return (
      <>
        <PageBand compact eyebrow="طلباتي" title={request.title || "طلب بلا عنوان"} />
        <PageBody>
          <Alert tone="info" title="لا يمكن تعديل الطلب في حالته الحالية">
            يُعدَّل الطلب وهو مسودة أو بعد إعادته إليكم للتعديل. <Link href={back} className="underline">عرض الطلب</Link>
          </Alert>
        </PageBody>
      </>
    );
  }

  const fields = request.requirements.filter((r) => r.kind === "FIELD");
  const attachments = request.requirements.filter((r) => r.kind === "ATTACHMENT");
  const custom = Object.fromEntries(fields.map((f) => [f.key, f.value ?? ""]));
  const returnNote = returned ? request.timeline.filter((t) => t.to.key === "RETURNED").at(-1)?.note : null;

  return (
    <>
      <PageBand
        compact
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/association/requests" className="hover:underline">
              طلباتي
            </Link>
            <span aria-hidden="true">/</span>
            {request.referenceNo ? <RefNumber value={request.referenceNo} /> : <span>مسودة</span>}
          </span>
        }
        title={returned ? "تعديل الطلب وإعادة تقديمه" : "بيانات الطلب"}
        lead={`${toArabicDigits(request.program.number)}. ${request.program.name} · المبادرة ${toArabicDigits(request.initiative.number)}. ${request.initiative.name}`}
        actions={
          <Link href={back} className={buttonClasses("outline")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            عرض الطلب
          </Link>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel className="p-6 lg:p-8">
            {returned ? (
              <Alert tone="warning" title="أُعيد الطلب إليكم للتعديل" className="mb-8">
                <span className="whitespace-pre-line">{returnNote ?? "عدّلوا البيانات المطلوبة ثم أعيدوا تقديم الطلب."}</span>
              </Alert>
            ) : null}
            <RequestForm
              requestId={id}
              returned={returned}
              fields={fields}
              defaults={{
                title: request.title,
                description: request.description ?? "",
                targetAudience: request.targetAudience ?? "",
                location: request.location ?? "",
                startDate: day(request.startDate),
                endDate: day(request.endDate),
                custom,
              }}
              attachments={attachments.map((a) => {
                const groups = acceptedGroups(a, allowedGroups);
                return {
                  requestId: id,
                  requirementKey: a.key,
                  label: a.label,
                  isRequired: a.isRequired,
                  acceptedText: arabicList(groups.map((g) => UPLOAD_GROUP_LABELS[g])),
                  accept: acceptAttribute(groups),
                  maxMb,
                  files: a.files,
                  canRemove: request.capabilities.canDiscard,
                };
              })}
            />
          </Panel>
          <aside className="flex flex-col gap-5 lg:sticky lg:top-[168px]">
            <FormSteps current={1}>
              <span className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">حالة الطلب</span>
                <StatusText tone={request.status.tone}>{request.status.name}</StatusText>
              </span>
              تُحفظ الملفات فور رفعها. احفظوا البيانات بزر «حفظ المسودة»، ثم قدّموا الطلب عند اكتماله؛ وسيعرض النظام ما ينقص إن وُجد.
            </FormSteps>
            {request.capabilities.canDiscard ? (
              <Panel className="p-5">
                <DiscardDraftButton requestId={id} title={request.title} />
              </Panel>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
