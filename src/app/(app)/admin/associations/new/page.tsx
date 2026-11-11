import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { InviteForm } from "@/components/registration/invite-form";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { createInvitationAction } from "@/server/actions/registration";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "جمعية جديدة" };

// Adding an association issues its registration link (D-149): the association completes its data
// and letter through the link, and its account is created when the super admin approves.
export default async function NewAssociationPage() {
  const user = await requireUser();
  if (!can(user.role, "associations.manage") || !can(user.role, "registrations.review")) return <ForbiddenPage />;
  const hours = await getSetting("registration.inviteHours");
  const today = new Date().toISOString();

  return (
    <>
      <PageBand
        compact
        eyebrow="الجمعيات"
        title="جمعية جديدة"
        lead="أدخل بيانات الجمعية الأساسية، ثم أرسل إليها رابط التسجيل لتستكمل بقية بياناتها وترفق الخطاب. يُنشأ حسابها بعد اعتماد الطلب."
        actions={
          <Link href="/admin/associations" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            سجل الجمعيات
          </Link>
        }
      />
      <PageBody>
        <InviteForm action={createInvitationAction} hours={hours} today={today} />
      </PageBody>
    </>
  );
}
