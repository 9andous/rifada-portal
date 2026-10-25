import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { InitiativeForm } from "@/components/taxonomy/entity-forms";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Panel } from "@/components/ui/surface";
import { toArabicDigits } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { createInitiativeAction } from "@/server/actions/admin/taxonomy";
import { getProgramDetail, getProgramMatrix } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "مبادرة جديدة" };

export default async function NewInitiativePage({ params }: PageProps<"/admin/taxonomy/programs/[number]/new-initiative">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const n = Number.parseInt((await params).number, 10);
  const program = Number.isInteger(n) ? await getProgramDetail(user, n) : null;
  if (!program) notFound();
  const { initiatives } = await getProgramMatrix(user, program.id, { includeArchived: true });
  const next = Math.max(0, ...initiatives.map((i) => i.number)) + 1;
  const path = `/admin/taxonomy/programs/${program.number}`;

  return (
    <>
      <PageBand
        compact
        eyebrow={`البرنامج ${toArabicDigits(program.number)}: ${program.name}`}
        title="مبادرة جديدة"
        lead="تُضاف المبادرة نشطة. حدّد بعد ذلك ارتباطها بالأهداف الإستراتيجية ومتطلباتها."
        actions={
          <Link href={`${path}?tab=initiatives`} className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            مبادرات البرنامج
          </Link>
        }
      />
      <PageBody>
        <Panel className="max-w-3xl p-6">
          {program.archivedAt ? (
            <Alert tone="warning">البرنامج مؤرشف؛ استعده أولًا لإضافة مبادرات إليه.</Alert>
          ) : (
            <InitiativeForm
              mode="create"
              action={createInitiativeAction.bind(null, program.id)}
              afterCreateBase="/admin/taxonomy/initiatives"
              defaults={{ number: String(next), name: "", description: "", sourceNote: "" }}
            />
          )}
        </Panel>
      </PageBody>
    </>
  );
}
