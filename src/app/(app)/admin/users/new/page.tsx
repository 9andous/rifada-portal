import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UserForm } from "@/components/admin/user-form";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { createUserAction } from "@/server/actions/admin/users";
import { userFormOptions } from "@/server/services/admin/users";

export const metadata: Metadata = { title: "مستخدم جديد" };

export default async function NewUserPage() {
  const user = await requireUser();
  if (!can(user.role, "users.manage")) return <ForbiddenPage />;
  const options = await userFormOptions(user);

  return (
    <>
      <PageBand
        compact
        eyebrow="المستخدمون"
        title="مستخدم جديد"
        lead="أدخل بيانات صاحب الحساب واختر دوره. للمشرف برنامج واحد أو أكثر، ولمسؤول الجمعية جمعية واحدة."
        actions={
          <Link href="/admin/users" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            قائمة المستخدمين
          </Link>
        }
      />
      <PageBody>
        <Panel className="mx-auto max-w-6xl">
          <PanelHeader title="بيانات الحساب" />
          <div className="px-6 pb-6">
            <UserForm mode="create" action={createUserAction} programs={options.programs} associations={options.associations} />
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
