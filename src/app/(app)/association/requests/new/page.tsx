import type { Metadata } from "next";
import { Ban, Inbox } from "lucide-react";
import { BackLink } from "@/components/association/parts";
import { RequestWizard } from "@/components/association/request-wizard";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { arabicList } from "@/lib/format";
import { acceptAttribute } from "@/lib/uploads";
import { UPLOAD_GROUP_LABELS } from "@/lib/validation/settings";
import { newRequestOptions } from "@/server/services/requests/drafts";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "تقديم طلب جديد" };

/**
 * A new request (D-102, D-123): the request form itself, from «عن المشروع». The draft is created on
 * the first «التالي», with the track, the type and what was typed.
 */
export default async function NewRequestPage() {
  const user = await requireUser();
  if (!can(user.role, "requests.create")) return <ForbiddenPage />;
  const [{ tracks, requestTypes, associationActive }, maxMb, allowedGroups] = await Promise.all([newRequestOptions(user), getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);

  return (
    <>
      <PageBand
        compact
        eyebrow={user.associationName ?? undefined}
        title="تقديم طلب جديد"
        lead="يُقدَّم الطلب في خطوات قصيرة. يُحفظ مسودة عند الانتقال إلى الخطوة الثانية، فيمكنكم إكماله لاحقًا."
        actions={<BackLink href="/association" label="العودة إلى الرئيسية" />}
      />
      <PageBody>
        {!associationActive ? (
          <EmptyState icon={<Ban strokeWidth={1.75} />} title="حساب الجمعية غير نشط" description="لا يمكن تقديم طلبات جديدة حتى يُفعَّل حساب الجمعية. تواصلوا مع الوحدة الإشرافية." />
        ) : tracks.length === 0 || requestTypes.length === 0 ? (
          <EmptyState icon={<Inbox strokeWidth={1.75} />} title="لا تُستقبل طلبات حاليًا" description="لم تُضبط المسارات أو أنواع الطلبات بعد. أعيدوا المحاولة لاحقًا أو تواصلوا مع الوحدة الإشرافية." />
        ) : (
          <RequestWizard
            requestId={null}
            returned={false}
            returnNote={null}
            returnedAt={null}
            canDiscard
            requestTitle=""
            tracks={tracks}
            requestTypes={requestTypes}
            defaults={{ trackId: "", requestTypeId: "", title: "", description: "", goals: "", expectedBeneficiaries: "", startDate: "", endDate: "", estimatedBudget: "", kpis: "", partners: "" }}
            ownFiles={{
              requestId: "",
              requirementKey: "own",
              own: true,
              label: "ملفات داعمة",
              isRequired: false,
              acceptedText: arabicList(allowedGroups.map((g) => UPLOAD_GROUP_LABELS[g])),
              accept: acceptAttribute(allowedGroups),
              maxMb,
              files: [],
              canRemove: true,
            }}
          />
        )}
      </PageBody>
    </>
  );
}
