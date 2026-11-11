import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, Download } from "lucide-react";
import { AssociationStatusPanel } from "@/components/admin/association-detail";
import { AssociationForm } from "@/components/admin/association-form";
import { imageUrl } from "@/lib/images";
import { AssociationOfficerCreator } from "@/components/admin/association-officer-creator";
import { AssociationStatusActions } from "@/components/admin/association-status-actions";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { updateAssociationAction } from "@/server/actions/admin/associations";
import { getAssociationDetail } from "@/server/services/admin/associations";
import { registrationOfAssociation } from "@/server/services/registrations";
import { placeLabels, siteLabel } from "@/lib/service-places";

export const metadata: Metadata = { title: "بيانات الجمعية" };

export default async function AdminAssociationPage({ params }: PageProps<"/admin/associations/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "associations.manage")) return <ForbiddenPage />;
  const { id } = await params;
  const [association, registration] = await Promise.all([getAssociationDetail(user, id), registrationOfAssociation(user, id)]);
  if (!association) notFound();

  return (
    <>
      <PageBand
        compact
        eyebrow="الجمعيات"
        title={association.name}
        lead={[association.city, association.region].filter(Boolean).join("، ") || undefined}
        actions={
          <Link href="/admin/associations" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            سجل الجمعيات
          </Link>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-6">
            <Panel>
              <PanelHeader title="تعديل بيانات الجمعية" />
              <div className="px-6 pb-6">
                <AssociationForm
                  mode="edit"
                  action={updateAssociationAction.bind(null, association.id)}
                  defaults={{
                    name: association.name,
                    licenseNumber: association.licenseNumber ?? "",
                    city: association.city ?? "",
                    region: association.region ?? "",
                    classification: association.classification ?? "",
                    contactName: association.contactName ?? "",
                    contactEmail: association.contactEmail ?? "",
                    contactPhone: association.contactPhone ?? "",
                    imageUrl: imageUrl("association", association.id, association.logoKey),
                  }}
                />
              </div>
            </Panel>
            {registration ? (
              <Panel>
                <PanelHeader
                  title="من طلب التسجيل"
                  actions={
                    <Link href={`/admin/registrations/${registration.id}`} className={buttonClasses("ghost", "sm")}>
                      <ClipboardList aria-hidden="true" strokeWidth={1.75} />
                      <bdi dir="ltr">{registration.referenceNo}</bdi>
                    </Link>
                  }
                />
                <dl className="grid gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-ink-subtle">موقع تقديم الخدمة</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">{siteLabel(registration.serviceSite) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-subtle">المسؤول الثاني</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">
                      {registration.secondOfficerName ?? "—"}
                      {registration.secondOfficerPhone ? (
                        <bdi dir="ltr" className="t-caption ms-2">
                          {registration.secondOfficerPhone}
                        </bdi>
                      ) : null}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-ink-subtle">أماكن تقديم الخدمة</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {placeLabels(registration.serviceSite, registration.servicePlaces).map((p) => (
                        <span key={p} className="rounded-md border border-line bg-surface-muted px-2 py-0.5 text-sm text-ink">
                          {p}
                        </span>
                      ))}
                    </dd>
                  </div>
                  {registration.letterKey ? (
                    <div className="sm:col-span-2">
                      <a href={`/api/admin/registrations/${registration.id}/letter`} className={buttonClasses("outline", "sm")}>
                        <Download aria-hidden="true" strokeWidth={1.75} />
                        تنزيل الخطاب
                      </a>
                    </div>
                  ) : null}
                </dl>
              </Panel>
            ) : null}
            <AssociationOfficerCreator
              associationId={association.id}
              hasOfficer={Boolean(association.officer)}
              isActive={association.isActive}
            />
          </div>
          <AssociationStatusPanel association={association} linkOfficer requestsHref={`/admin/requests?association=${association.id}`}>
            <AssociationStatusActions
              associationId={association.id}
              name={association.name}
              isActive={association.isActive}
              hasActiveOfficer={Boolean(association.officer?.isActive)}
              hasOfficer={Boolean(association.officer)}
            />
          </AssociationStatusPanel>
        </div>
      </PageBody>
    </>
  );
}
