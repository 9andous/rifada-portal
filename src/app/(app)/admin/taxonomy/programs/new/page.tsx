import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ProgramForm } from "@/components/taxonomy/entity-forms";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { createProgramAction } from "@/server/actions/admin/taxonomy";
import { listPrograms, parseProgramListParams } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "برنامج جديد" };

export default async function NewProgramPage() {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const programs = await listPrograms(user, parseProgramListParams({}));
  const next = Math.max(0, ...programs.map((p) => p.number)) + 1;

  return (
    <>
      <PageBand
        compact
        eyebrow="البرامج والمبادرات"
        title="برنامج جديد"
        lead="يُضاف البرنامج نشطًا. يمكن بعد ذلك إضافة أهدافه ومبادراته."
        actions={
          <Link href="/admin/taxonomy" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            البرامج
          </Link>
        }
      />
      <PageBody>
        <Panel className="max-w-3xl p-6">
          <ProgramForm mode="create" action={createProgramAction} defaults={{ number: String(next), name: "", officialName: "", description: "", sortOrder: String(next) }} />
        </Panel>
      </PageBody>
    </>
  );
}
