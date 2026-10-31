import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, KeyRound, Layers, PenLine, UserRound } from "lucide-react";
import { AssociationProfileForm } from "@/components/association/profile-form";
import { ProgramIcon } from "@/components/brand/program-icon";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Alert, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { formatHijri, toArabicDigits } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getOwnAssociationProfile } from "@/server/services/association-profile";

export const metadata: Metadata = { title: "ملف الجمعية" };

function Pair({ label, children, ltr }: { label: string; children: ReactNode; ltr?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className={ltr ? "mt-0.5 break-words text-end text-base text-ink" : "mt-0.5 break-words text-base text-ink"} dir={ltr ? "ltr" : undefined}>
        {children ?? <span className="text-ink-subtle">—</span>}
      </dd>
    </div>
  );
}

/** «ملف الجمعية» (D-101, D-102): who the association is, its contact details and logo, its account and programmes. */
export default async function AssociationProfilePage() {
  const user = await requireUser();
  if (!can(user.role, "associations.profile")) return <ForbiddenPage />;
  const a = await getOwnAssociationProfile(user);
  if (!a) notFound();
  const location = [a.city, a.region].filter(Boolean).join("، ");

  return (
    <>
      <PageBand eyebrow="ملف الجمعية" title={a.name} lead="بيانات جمعيتكم في المنصة. يمكنكم تحديث بيانات التواصل والشعار من هذه الصفحة." />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-w-0 flex-col gap-5">
            {/* Identity: the logo on a white plate, the name and the registry data the unit manages. */}
            <Panel className="overflow-hidden">
              <div className="band-scope flex flex-wrap items-center gap-5 bg-band px-6 py-6 text-band-ink">
                <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-band-gold/60 bg-white p-2 shadow-2">
                  {a.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a private, signed-in-only image
                    <img src={a.logo} alt={`شعار ${a.name}`} className="size-full object-contain" />
                  ) : (
                    <Avatar name={a.name} className="size-full rounded-lg text-2xl" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-band-gold">{a.classification ?? "جمعية"}</p>
                  <h2 className="mt-1 text-[1.375rem] font-bold leading-snug">{a.name}</h2>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9375rem] text-band-ink-muted">
                    {a.licenseNumber ? (
                      <span className="inline-flex items-center gap-1.5">
                        <BadgeCheck aria-hidden="true" className="size-4 text-band-gold" strokeWidth={1.75} />
                        ترخيص رقم <bdi dir="ltr">{toArabicDigits(a.licenseNumber)}</bdi>
                      </span>
                    ) : null}
                    {location ? <span>{location}</span> : null}
                  </p>
                </div>
                <StatusText tone={a.isActive ? "ok" : "neutral"} className="bg-white/90">
                  {a.isActive ? "جمعية نشطة" : "معطلة"}
                </StatusText>
              </div>
              <dl className="grid gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
                <Pair label="اسم الجمعية">{a.name}</Pair>
                <Pair label="رقم الترخيص">{a.licenseNumber ? <bdi dir="ltr">{toArabicDigits(a.licenseNumber)}</bdi> : null}</Pair>
                <Pair label="التصنيف">{a.classification}</Pair>
                <Pair label="المنطقة">{a.region}</Pair>
                <Pair label="المدينة">{a.city}</Pair>
                <Pair label="سنة التأسيس">{a.registration?.foundedYear ? `${toArabicDigits(a.registration.foundedYear)} هـ` : null}</Pair>
              </dl>
              <div className="px-6 pb-6">
                <Alert tone="info">لتغيير اسم الجمعية أو رقم الترخيص أو التصنيف أو الموقع، تواصلوا مع الوحدة الإشرافية.</Alert>
              </div>
            </Panel>

            <Panel>
              <PanelHeader icon={<PenLine strokeWidth={1.75} />} title="بيانات التواصل والشعار" description="عدّلوا ما يلزم، ثم اضغطوا «حفظ التغييرات»." />
              <div className="px-6 pb-6">
                <AssociationProfileForm name={a.name} logo={a.logo} contactName={a.contactName} contactEmail={a.contactEmail} contactPhone={a.contactPhone} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader icon={<Layers strokeWidth={1.75} />} title="مجالات العمل" description="برامج الرئاسة التي اختارتها الجمعية عند التسجيل." />
              {a.programs.length ? (
                <ul className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
                  {a.programs.map((p) => (
                    <li key={p.number} className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted p-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary [&_svg]:size-5">
                        <ProgramIcon number={p.number} />
                      </span>
                      <span className="text-[0.9375rem] font-bold text-ink">{p.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 pb-6 text-base text-ink-muted">لم تُحدَّد مجالات عمل للجمعية؛ يمكنكم التقديم في أي من برامج الرئاسة.</p>
              )}
            </Panel>
          </div>

          <div className="flex flex-col gap-5 lg:sticky lg:top-[168px]">
            <Panel>
              <PanelHeader icon={<UserRound strokeWidth={1.75} />} title="حساب الدخول" />
              {a.officer ? (
                <div className="px-6 pb-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.officer.name} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-ink">{a.officer.name}</p>
                      <p className="text-sm text-ink-muted">
                        اسم المستخدم: <bdi dir="ltr">{a.officer.username}</bdi>
                      </p>
                    </div>
                  </div>
                  <dl className="mt-5 grid gap-4">
                    <Pair label="البريد الإلكتروني" ltr>
                      {a.officer.email}
                    </Pair>
                    <Pair label="الجوال" ltr>
                      {a.officer.phone ? toArabicDigits(a.officer.phone) : null}
                    </Pair>
                    <Pair label="آخر دخول">{a.officer.lastLoginAt ? <DateDisplay date={a.officer.lastLoginAt} withTime /> : null}</Pair>
                  </dl>
                  <Link href="/account/change-password" className={buttonClasses("outline", "md", "mt-5 w-full")}>
                    <KeyRound aria-hidden="true" strokeWidth={1.75} />
                    تغيير كلمة المرور
                  </Link>
                </div>
              ) : (
                <p className="px-6 pb-6 text-base text-ink-muted">لا يوجد حساب مسؤول.</p>
              )}
            </Panel>

            <Panel>
              <PanelHeader icon={<Building2 strokeWidth={1.75} />} title="سجل الجمعية" />
              <dl className="grid gap-4 px-6 pb-6">
                <Pair label="رقم طلب التسجيل" ltr>
                  {a.registration?.referenceNo}
                </Pair>
                <Pair label="تاريخ الاعتماد">{a.registration?.reviewedAt ? formatHijri(a.registration.reviewedAt) : null}</Pair>
                <Pair label="التسجيل في المنصة">{formatHijri(a.createdAt)}</Pair>
              </dl>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
