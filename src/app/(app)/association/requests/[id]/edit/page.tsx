import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { BackLink } from "@/components/association/parts";
import { RequestWizard } from "@/components/association/request-wizard";
import { MarkRequestSeen } from "@/components/requests/mark-request-seen";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { RefNumber } from "@/components/ui/ref-number";
import { arabicList } from "@/lib/format";
import { acceptAttribute } from "@/lib/uploads";
import { UPLOAD_GROUP_LABELS } from "@/lib/validation/settings";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { newRequestOptions } from "@/server/services/requests/drafts";
import { getRequestDetail } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "كتابة بيانات الطلب" };

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** The officer writes or corrects a request, one step at a time (D-102). */
export default async function EditRequestPage({ params }: PageProps<"/association/requests/[id]/edit">) {
  const user = await requireUser();
  if (!can(user.role, "requests.editDraft")) return <ForbiddenPage />;
  const { id } = await params;
  const [request, maxMb, allowedGroups] = await Promise.all([getRequestDetail(user, id), getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);
  if (!request) notFound();
  const returned = request.status.key === "RETURNED";
  const back = `/association/requests/${id}`;
  const eyebrow = (
    <span className="flex flex-wrap items-center gap-2">
      <Link href="/association/requests" className="hover:underline">
        طلباتي
      </Link>
      <span aria-hidden="true">/</span>
      {request.referenceNo ? <RefNumber value={request.referenceNo} /> : <span>مسودة</span>}
    </span>
  );

  if (!request.capabilities.canEdit) {
    return (
      <>
        <PageBand compact eyebrow={eyebrow} title={request.title || "طلب بلا عنوان"} actions={<BackLink href={back} label="العودة إلى الطلب" />} />
        <PageBody>
          <EmptyState
            icon={<Lock strokeWidth={1.75} />}
            title="لا يمكن تعديل الطلب الآن"
            description="يُعدَّل الطلب وهو مسودة، أو بعد أن يعيده المشرف إليكم للتعديل."
            action={
              <Link href={back} className={buttonClasses("gold")}>
                عرض الطلب
              </Link>
            }
          />
        </PageBody>
      </>
    );
  }

  const returnMove = returned ? request.timeline.filter((t) => t.to.key === "RETURNED").at(-1) : undefined;
  const choices = await newRequestOptions(user);
  // A track or type archived since it was chosen stays offered for this request.
  const tracks = request.track && !choices.tracks.some((t) => t.id === request.track!.id) ? [...choices.tracks, { ...request.track, description: null }] : choices.tracks;
  const requestTypes =
    request.requestType && !choices.requestTypes.some((t) => t.id === request.requestType!.id) ? [...choices.requestTypes, { ...request.requestType, description: null }] : choices.requestTypes;
  const count = (n: number | null) => (n === null ? "" : String(n));

  return (
    <>
      <PageBand
        compact
        eyebrow={eyebrow}
        title={returned ? "تعديل الطلب وإعادة إرساله" : "كتابة بيانات الطلب"}
        lead={[request.track?.name, request.requestType?.name].filter(Boolean).join(" · ") || undefined}
        actions={<BackLink href={back} label="العودة إلى الطلب" />}
      />
      <PageBody>
        <MarkRequestSeen requestId={id} />
        <RequestWizard
          requestId={id}
          returned={returned}
          returnNote={returnMove?.note ?? null}
          returnedAt={returnMove?.createdAt ?? null}
          canDiscard={request.capabilities.canDiscard}
          requestTitle={request.title}
          tracks={tracks}
          requestTypes={requestTypes}
          defaults={{
            trackId: request.track?.id ?? "",
            requestTypeId: request.requestType?.id ?? "",
            title: request.title,
            description: request.description ?? "",
            goals: request.goals ?? "",
            expectedBeneficiaries: request.expectedBeneficiaries ?? "",
            startDate: day(request.startDate),
            endDate: day(request.endDate),
            estimatedBudget: count(request.estimatedBudget),
            kpis: request.kpis ?? "",
            partners: request.partners ?? "",
          }}
          ownFiles={{
            requestId: id,
            requirementKey: "own",
            own: true,
            label: "ملفات داعمة",
            isRequired: false,
            acceptedText: arabicList(allowedGroups.map((g) => UPLOAD_GROUP_LABELS[g])),
            accept: acceptAttribute(allowedGroups),
            maxMb,
            files: request.otherFiles,
            canRemove: request.capabilities.canDiscard,
          }}
        />
      </PageBody>
    </>
  );
}
