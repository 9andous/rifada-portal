import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AssociationStatusPanel, AssociationSummary } from "@/components/admin/association-detail";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { scopeFor } from "@/server/authz/permissions";
import { getAssociationDetail } from "@/server/services/admin/associations";

export const metadata: Metadata = { title: "بيانات الجمعية" };

export default async function ManagerAssociationPage({ params }: PageProps<"/manager/associations/[id]">) {
  const user = await requireUser();
  if (scopeFor(user.role, "associations.read") !== "all") return <ForbiddenPage />;
  const { id } = await params;
  const association = await getAssociationDetail(user, id);
  if (!association) notFound();

  return (
    <>
      <PageBand
        compact
        eyebrow="الجمعيات"
        title={association.name}
        lead={[association.city, association.region].filter(Boolean).join("، ") || undefined}
        actions={
          <Link href="/manager/associations" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            سجل الجمعيات
          </Link>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <AssociationSummary association={association} />
          <AssociationStatusPanel association={association} linkOfficer={false} requestsHref={`/manager/requests?association=${association.id}`} />
        </div>
      </PageBody>
    </>
  );
}
