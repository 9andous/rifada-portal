import type { Metadata } from "next";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { TracksList } from "@/components/taxonomy/tracks-editor";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listTracks } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "المسارات" };

/** «المسارات» (D-119): the five tracks above the programmes; internal, never shown to associations. */
export default async function ManagerTracksPage() {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.read")) return <ForbiddenPage />;
  const { tracks, programs, unplaced } = await listTracks(user, false);

  return (
    <>
      <PageBand compact title="المسارات" lead="المسارات الخمسة في نطاق الإشراف الفني، وبرامج الرئاسة في كل مسار. تختار الجمعية المسار عند تقديم الطلب، ويرى المشرف برامج المسار." />
      <PageBody>
        <TaxonomyNav active="tracks" base="/manager/taxonomy" />
        {unplaced.length ? (
          <Alert tone="warning" title="برامج خارج المسارات" className="mb-5">
            {unplaced.map((p) => p.name).join("، ")}: لا تندرج في أي مسار نشط، فتُحسب طلباتها «غير مصنّفة» في لوحات المتابعة.
          </Alert>
        ) : null}
        <Panel>
          <PanelHeader title="المسارات" description="المجموعة التاسعة — منظمات خدمة ضيوف الرحمن"  />
          {tracks.length === 0 ? (
            <EmptyState variant="inline" title="لا توجد مسارات بعد" description="تُحمَّل المسارات الخمسة مع البيانات الأساسية." />
          ) : (
            <TracksList tracks={tracks} programs={programs} readOnly={true} />
          )}
        </Panel>
      </PageBody>
    </>
  );
}
