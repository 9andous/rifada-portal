import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { TemplatesLibrary } from "@/components/templates/templates-library";
import { toArabicDigits } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "الأدلة والنماذج" };

const STEPS = [
  { title: "اختاروا ما تحتاجونه", text: "الأدلة للاطلاع والاسترشاد، والنماذج تُعبأ وتُرفق بالطلب." },
  { title: "نزّلوا الملف", text: "اضغطوا «تنزيل» على البطاقة؛ يُحفظ الملف في جهازكم." },
  { title: "أرفقوا النموذج بعد تعبئته", text: "في خطوة «متطلبات المبادرة» من الطلب، بالاسم المكتوب على البطاقة." },
];

/** «الأدلة والنماذج» for the association (D-102, D-113). */
export default async function AssociationDocumentsPage({ searchParams }: PageProps<"/association/documents">) {
  const user = await requireUser();
  if (!can(user.role, "templates.read")) return <ForbiddenPage />;

  return (
    <>
      <PageBand title="الأدلة والنماذج" lead="أدلة ونماذج تنشرها الوحدة الإشرافية لمساعدتكم في إعداد طلباتكم." />
      <PageBody>
        <ol className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-1">
              <span aria-hidden="true" className="t-figure flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-ink">
                {toArabicDigits(i + 1)}
              </span>
              <div>
                <p className="font-bold text-ink">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Suspense fallback={<ListSkeleton />}>
          <TemplatesLibrary actor={user} searchParams={searchParams} path="/association/documents" />
        </Suspense>
      </PageBody>
    </>
  );
}
