import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { TemplateForm } from "@/components/templates/template-forms";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { acceptAttribute } from "@/lib/uploads";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { createTemplateAction } from "@/server/actions/admin/templates";
import { templateFormOptions } from "@/server/services/admin/templates";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "نموذج جديد" };

export default async function NewTemplatePage() {
  const user = await requireUser();
  if (!can(user.role, "content.manage")) return <ForbiddenPage />;
  const [options, maxMb, groups] = await Promise.all([templateFormOptions(user), getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);

  return (
    <>
      <PageBand
        compact
        eyebrow="النماذج"
        title="نموذج جديد"
        lead="ارفع الملف ثم أكمل بياناته. يُرفع الملف إلى منطقة مؤقتة ويُتحقق من نوعه ومحتواه قبل الحفظ."
        actions={
          <Link href="/admin/taxonomy/templates" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            النماذج
          </Link>
        }
      />
      <PageBody>
        <Panel className="max-w-3xl p-6">
          <TemplateForm
            mode="create"
            action={createTemplateAction}
            defaults={{ title: "", description: "", programId: "", initiativeId: "", attachmentTypeId: "" }}
            programs={options.programs}
            attachmentTypes={options.attachmentTypes}
            accept={acceptAttribute(groups)}
            maxMb={maxMb}
          />
        </Panel>
      </PageBody>
    </>
  );
}
