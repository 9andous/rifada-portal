import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AssociationForm } from "@/components/admin/association-form";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { createAssociationAction } from "@/server/actions/admin/associations";

export const metadata: Metadata = { title: "جمعية جديدة" };

export default async function NewAssociationPage() {
  const user = await requireUser();
  if (!can(user.role, "associations.manage")) return <ForbiddenPage />;

  return (
    <>
      <PageBand
        compact
        eyebrow="الجمعيات"
        title="جمعية جديدة"
        lead="سجّل بيانات الجمعية ووسائل التواصل معها، ويمكنك إنشاء حساب مسؤولها في الخطوة نفسها."
        actions={
          <Link href="/admin/associations" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            سجل الجمعيات
          </Link>
        }
      />
      <PageBody>
        <Panel className="max-w-4xl p-6">
          <AssociationForm mode="create" action={createAssociationAction} />
        </Panel>
      </PageBody>
    </>
  );
}
