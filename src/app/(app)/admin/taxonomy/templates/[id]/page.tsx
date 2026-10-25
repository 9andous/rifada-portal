import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ReplaceFileForm, TemplateForm, TemplateStateActions } from "@/components/templates/template-forms";
import { downloadHref, fileKind, TEMPLATE_STATE_LABEL } from "@/components/templates/templates-list";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { formatFileSize, toArabicDigits } from "@/lib/format";
import { acceptAttribute } from "@/lib/uploads";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { updateTemplateAction } from "@/server/actions/admin/templates";
import { getTemplateDetail, templateFormOptions } from "@/server/services/admin/templates";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "النموذج" };

export default async function AdminTemplatePage({ params }: PageProps<"/admin/taxonomy/templates/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "content.manage")) return <ForbiddenPage />;
  const { id } = await params;
  const template = await getTemplateDetail(user, id);
  if (!template) notFound();
  const [options, maxMb, groups] = await Promise.all([templateFormOptions(user), getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);
  const state = TEMPLATE_STATE_LABEL[template.state];
  const current = template.files.find((f) => f.id === template.currentFileId);
  const accept = acceptAttribute(groups);

  return (
    <>
      <PageBand
        compact
        eyebrow="النماذج"
        title={template.title}
        lead={template.description ?? undefined}
        actions={
          <>
            <a href={downloadHref(template.id)} className={buttonClasses("onBand")}>
              <Download strokeWidth={1.75} aria-hidden="true" />
              تنزيل الملف الحالي
            </a>
            <Link href="/admin/taxonomy/templates" className={buttonClasses("onBand")}>
              <ArrowRight strokeWidth={1.75} aria-hidden="true" />
              النماذج
            </Link>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col gap-6">
            <Panel>
              <PanelHeader title="بيانات النموذج" />
              <div className="px-6 pb-6">
                <TemplateForm
                  mode="edit"
                  action={updateTemplateAction.bind(null, template.id)}
                  defaults={{
                    title: template.title,
                    description: template.description ?? "",
                    programId: template.programId ?? "",
                    initiativeId: template.initiativeId ?? "",
                    attachmentTypeId: template.attachmentTypeId ?? "",
                  }}
                  programs={options.programs}
                  attachmentTypes={options.attachmentTypes}
                  accept={accept}
                  maxMb={maxMb}
                />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="سجل الإصدارات" description="كل ملف رُفع لهذا النموذج. الإصدارات السابقة لا تُحذف ولا يُنزّلها إلا مدير النظام." />
              <div className="overflow-x-auto">
                <table className="t-table w-full min-w-[40rem] border-collapse">
                  <caption className="sr-only">إصدارات الملف</caption>
                  <thead className="bg-surface-muted">
                    <tr>
                      <th scope="col" className="t-label w-20 py-2.5 ps-6 text-start">
                        الإصدار
                      </th>
                      <th scope="col" className="t-label py-2.5 text-start">
                        الملف
                      </th>
                      <th scope="col" className="t-label py-2.5 text-start">
                        رفعه
                      </th>
                      <th scope="col" className="w-20 py-2.5 pe-6">
                        <span className="sr-only">تنزيل</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.files.map((f) => (
                      <tr key={f.id} className="border-b border-line last:border-0">
                        <td className="t-figure py-3 ps-6 align-top font-semibold text-ink-subtle">
                          {toArabicDigits(f.versionNo)}
                          {f.id === template.currentFileId ? <span className="t-caption block font-normal">الحالي</span> : null}
                        </td>
                        <td className="py-3 pe-4 align-top text-sm">
                          <bdi>{f.fileName}</bdi>
                          <span className="t-caption mt-0.5 block">
                            {fileKind(f.fileName)} · {formatFileSize(f.size)} · SHA-256{" "}
                            <bdi dir="ltr" className="font-mono">
                              {f.sha256.slice(0, 12)}
                            </bdi>
                          </span>
                        </td>
                        <td className="py-3 pe-4 align-top text-sm">
                          {f.uploadedBy.name}
                          <span className="t-caption mt-0.5 block">
                            <DateDisplay date={f.createdAt} withTime />
                          </span>
                        </td>
                        <td className="py-1.5 pe-6 align-top">
                          <a href={downloadHref(template.id, f.versionNo)} className={buttonClasses("ghost", "sm")} aria-label={`تنزيل الإصدار ${toArabicDigits(f.versionNo)}`}>
                            <Download aria-hidden="true" strokeWidth={1.75} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
          <div className="flex flex-col gap-6">
            <Panel>
              <PanelHeader title="الحالة" />
              <div className="flex flex-col gap-4 px-6 pb-6">
                <StatusText tone={state.tone}>{state.label}</StatusText>
                <p className="t-caption">
                  {template.state === "published" ? "يظهر لمسؤولي الجمعيات والمشرفين ومدير الوحدة ويستطيعون تنزيله." : "لا يظهر لأحد غير مدير النظام."}
                </p>
                <TemplateStateActions id={template.id} title={template.title} published={template.isPublished} archived={Boolean(template.archivedAt)} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="استبدال الملف" description={current ? `الحالي: الإصدار ${toArabicDigits(current.versionNo)}، ${formatFileSize(current.size)}` : undefined} />
              <div className="px-6 pb-6">
                <ReplaceFileForm templateId={template.id} accept={accept} maxMb={maxMb} />
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
