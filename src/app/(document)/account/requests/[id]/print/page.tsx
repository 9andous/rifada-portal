import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { VerificationQr } from "@/components/requests/verification-qr";
import { RefNumber } from "@/components/ui/ref-number";
import { brand } from "@/config/brand";
import { formatGregorian, formatHijri, formatNumber, formatTime, toArabicDigits } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getRequestDetail, type FileView } from "@/server/services/requests/read";
import { verifyUrl } from "@/server/services/verification";
import { DocumentToolbar } from "./toolbar";

export const metadata: Metadata = { title: "نموذج طلب" };

/*
 * The request as a formal A4 document (owner's request, D-110): black on white, bordered tables,
 * numbered sections, a decision block and the electronic seals, page numbers in the margin. Every
 * role that may read the request may print it; getRequestDetail enforces the scope (otherwise 404).
 * The association prints only an approved request (D-114). An approved request carries the seals of
 * the supervisor and the unit manager and the QR code of its verification page (D-122).
 */

const DECISION_KEYS = new Set(["APPROVED", "REJECTED", "RETURNED"]);

const empty = <span className="text-[#555]">—</span>;

function text(value: string | null | undefined): ReactNode {
  return value?.trim() ? <span className="whitespace-pre-line">{toArabicDigits(value.trim())}</span> : empty;
}

function dual(date: Date | null | undefined): ReactNode {
  if (!date) return empty;
  return (
    <>
      {formatHijri(date)} <span className="text-[#444]">الموافق {formatGregorian(date)}</span>
    </>
  );
}

function fieldValue(type: string | null, value: string | null): ReactNode {
  if (!value?.trim()) return empty;
  if (type === "DATE" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dual(new Date(`${value}T12:00:00Z`));
  return text(value);
}

/** An electronic seal in the signature line (D-122). */
function SealMark({ serial }: { serial: string }) {
  return (
    <span className="block text-center">
      <span className="block font-bold">موقّع إلكترونيًا</span>
      <span className="block text-[8pt]">
        رقم الختم <bdi dir="ltr">{serial}</bdi>
      </span>
    </span>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="doc-section mt-6">
      <h2 className="mb-2 border-b-2 border-black pb-1 text-[11.5pt] font-bold">
        {toArabicDigits(n)}. {title}
      </h2>
      {children}
    </section>
  );
}

/** Label/value rows; `pairs` puts two rows side by side. */
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="doc-table w-full border-collapse text-[10pt]">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row" className="w-[28%] border border-black bg-[#efefef] px-2.5 py-1.5 text-start align-top font-bold">
              {label}
            </th>
            <td className="border border-black px-2.5 py-1.5 align-top leading-[1.8]">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Session-dependent: rendered at request time behind Suspense (Cache Components).
export default function RequestDocumentPage({ params }: PageProps<"/account/requests/[id]/print">) {
  return (
    <Suspense fallback={<p className="p-10 text-center">جارٍ تجهيز المستند…</p>}>
      <RequestDocument params={params} />
    </Suspense>
  );
}

async function RequestDocument({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await getRequestDetail(user, id);
  if (!r || !r.capabilities.canPrint) notFound();

  const now = new Date();
  const fields = r.requirements.filter((q) => q.kind === "FIELD");
  const files: { type: string; file: FileView | null }[] = [
    ...r.requirements.filter((q) => q.kind === "ATTACHMENT").flatMap((q): { type: string; file: FileView | null }[] => (q.files.length ? q.files.map((f) => ({ type: q.label, file: f })) : [{ type: q.label, file: null }])),
    ...r.otherFiles.map((f) => ({ type: "ملف إضافي من الجمعية", file: f })),
  ];
  const decision = [...r.timeline].reverse().find((t) => DECISION_KEYS.has(t.to.key));
  // Signed electronically (D-122): the approved document's seals for every reader; on staff copies
  // before the final approval, the supervisor's seal of the latest evaluation (D-116).
  const certificate = r.certificate;
  const evaluation = r.review?.evaluations.at(-1) ?? null;
  const supervisorSeal =
    certificate?.signers.find((x) => x.kind === "EVALUATION") ??
    (evaluation?.seal ? { name: evaluation.reviewer, serial: evaluation.seal.serial, signedAt: evaluation.createdAt } : null);
  const managerSeal = certificate?.signers.find((x) => x.kind === "APPROVAL") ?? null;
  const managerDecision = evaluation && decision && decision.createdAt > evaluation.createdAt ? decision : null;
  const signers: { role: string; name: string | null; date: Date | null; mark: ReactNode }[] = [
    { role: "مقدِّم الطلب", name: r.createdBy, date: r.submittedAt, mark: r.submittedAt ? "قُدِّم إلكترونيًا عبر المنصة" : null },
    {
      role: "المشرف المختص",
      name: supervisorSeal?.name ?? r.assignment?.supervisor?.name ?? null,
      date: supervisorSeal?.signedAt ?? null,
      mark: supervisorSeal ? <SealMark serial={supervisorSeal.serial} /> : null,
    },
    {
      role: "مدير الوحدة الإشرافية",
      name: managerSeal?.name ?? managerDecision?.actor ?? null,
      date: managerSeal?.signedAt ?? managerDecision?.createdAt ?? null,
      mark: managerSeal ? <SealMark serial={managerSeal.serial} /> : null,
    },
  ];
  const verifyPage = verifyUrl("").replace(/\/$/, "");

  // Printed in the bottom margin of every page, next to the page number.
  const ref = r.referenceNo ? `⁦${toArabicDigits(r.referenceNo).replace(/-/g, "‎-‎")}⁩` : null;
  const footerLine = `وثيقة صادرة إلكترونيًا من ${brand.systemName}${ref ? ` — رقم الطلب ${ref}` : ""}`;
  const days =
    r.startDate && r.endDate ? Math.round((r.endDate.getTime() - r.startDate.getTime()) / 86_400_000) + 1 : null;

  return (
    <div className="doc-root min-h-dvh bg-[#e9e9e9] text-black print:bg-white">
      <style>{`
        @page doc { size: A4 portrait; margin: 14mm 15mm 18mm;
          @bottom-right { content: ${JSON.stringify(footerLine)}; font-size: 7.5pt; color: #000; }
          @bottom-left { content: "صفحة " counter(page, arabic-indic) " من " counter(pages, arabic-indic); font-size: 8pt; color: #000; }
        }
        .doc-sheet { page: doc; }
        @media print {
          html, body { background: #fff !important; }
          .doc-sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-height: 0 !important; }
          .doc-section { break-inside: auto; }
          .doc-section h2, .doc-table tr, .doc-keep { break-inside: avoid; }
          .doc-section h2 { break-after: avoid; }
        }
      `}</style>

      <DocumentToolbar title={r.title} />

      <article className="doc-sheet mx-auto my-6 w-[210mm] min-h-[297mm] bg-white px-[15mm] py-[14mm] text-[10.5pt] leading-[1.7] shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
        {/* Letterhead */}
        {/* The Presidency's emblem on the right, the issuing body's text centred, the platform's logo
            on the left (owner's request). */}
        <header className="doc-keep grid grid-cols-[1fr_2.4fr_1fr] items-center gap-4 border-b-[3px] border-double border-black pb-3">
          <div className="flex justify-start">
            <Image src={brand.presidencyLogo.src} alt={brand.presidencyLogo.alt} width={134} height={85} className="grayscale" priority />
          </div>
          <div className="text-center text-[9.5pt] font-bold leading-[1.8]">
            <p>المملكة العربية السعودية</p>
            <p>{brand.presidencyName}</p>
            <p>{brand.unitName}</p>
            <p className="font-normal">{brand.systemName}</p>
          </div>
          <div className="flex justify-end">
            <Image src={brand.logo.color.src} alt={brand.logo.alt} width={66} height={76} className="grayscale" priority />
          </div>
        </header>

        {/* Title and reference block */}
        <div className="doc-keep mt-5 text-center">
          <h1 className="text-[16pt] font-bold">نموذج طلب مشروع</h1>
          <p className="text-[10pt]">مقدَّم ضمن برامج {brand.presidencyName}</p>
        </div>
        <table className="doc-table doc-keep mt-4 w-full border-collapse text-[9.5pt]">
          <tbody>
            <tr>
              <th className="border border-black bg-[#efefef] px-2 py-1 text-start font-bold">رقم الطلب</th>
              <td className="border border-black px-2 py-1 font-bold">
                {r.referenceNo ? <RefNumber value={r.referenceNo} /> : "مسودة (لم يُرسل بعد)"}
              </td>
              <th className="border border-black bg-[#efefef] px-2 py-1 text-start font-bold">حالة الطلب</th>
              <td className="border border-black px-2 py-1 font-bold">{r.status.name}</td>
            </tr>
            <tr>
              <th className="border border-black bg-[#efefef] px-2 py-1 text-start font-bold">تاريخ التقديم</th>
              <td className="border border-black px-2 py-1">{r.submittedAt ? formatHijri(r.submittedAt) : empty}</td>
              <th className="border border-black bg-[#efefef] px-2 py-1 text-start font-bold">تاريخ الطباعة</th>
              <td className="border border-black px-2 py-1">
                {formatHijri(now)}، {formatTime(now)}
              </td>
            </tr>
          </tbody>
        </table>

        <Section n={1} title="بيانات الجهة المتقدمة">
          <Rows
            rows={[
              ["اسم الجمعية", text(r.association.name)],
              ["مقدِّم الطلب", text(r.createdBy)],
            ]}
          />
        </Section>

        <Section n={2} title="المسار ونوع الطلب">
          <Rows
            rows={[
              ["المسار المستهدف", text(r.track?.name ?? null)],
              ["نوع الطلب", text(r.requestType?.name ?? null)],
              ...(r.program
                ? ([
                    ["البرنامج", <>{toArabicDigits(r.program.number)}. {r.program.name}</>],
                    [
                      r.initiatives.length > 1 ? "المبادرات" : "المبادرة",
                      <>
                        {r.initiatives.map((i) => (
                          <span key={i.id} className="block">
                            {toArabicDigits(i.number)}. {i.name}
                          </span>
                        ))}
                      </>,
                    ],
                  ] as [string, ReactNode][])
                : []),
            ]}
          />
        </Section>

        <Section n={3} title="بيانات المشروع">
          <Rows
            rows={[
              ["اسم المشروع أو البرنامج", <span key="t" className="font-bold">{text(r.title)}</span>],
              ["وصف المشروع", text(r.description)],
              ["الأهداف والمخرجات المتوقعة", text(r.goals)],
              ...(r.targetAudience ? ([["الفئة المستهدفة", text(r.targetAudience)]] as [string, ReactNode][]) : []),
              ...(r.location ? ([["مكان التنفيذ", text(r.location)]] as [string, ReactNode][]) : []),
              ["الفئات المستهدفة", text(r.expectedBeneficiaries)],
              ["الميزانية التقديرية", r.estimatedBudget !== null ? `${formatNumber(r.estimatedBudget)} ر.س` : empty],
              ["تاريخ البداية", dual(r.startDate)],
              ["تاريخ النهاية", dual(r.endDate)],
              ["مدة التنفيذ", days && days > 0 ? `${toArabicDigits(days)} يومًا` : empty],
              ["مؤشرات القياس", text(r.kpis)],
              ["الشركاء", text(r.partners)],
            ]}
          />
        </Section>

        {fields.length || r.otherValues.length ? (
          <Section n={4} title="متطلبات المبادرة">
            <Rows rows={[...fields.map((f): [string, ReactNode] => [f.label, fieldValue(f.fieldType, f.value)]), ...r.otherValues.map((v): [string, ReactNode] => [v.key, text(v.value)])]} />
          </Section>
        ) : null}

        <Section n={fields.length || r.otherValues.length ? 5 : 4} title="المرفقات">
          {files.length ? (
            <table className="doc-table w-full border-collapse text-[9.5pt]">
              <thead>
                <tr className="bg-[#efefef]">
                  <th className="w-10 border border-black px-2 py-1.5 text-center font-bold">م</th>
                  <th className="border border-black px-2 py-1.5 text-start font-bold">نوع المرفق</th>
                  <th className="border border-black px-2 py-1.5 text-start font-bold">اسم الملف</th>
                  <th className="w-36 border border-black px-2 py-1.5 text-start font-bold">تاريخ الرفع</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={`${f.type}-${f.file?.attachmentId ?? i}`}>
                    <td className="border border-black px-2 py-1.5 text-center">{toArabicDigits(i + 1)}</td>
                    <td className="border border-black px-2 py-1.5">{f.type}</td>
                    <td className="border border-black px-2 py-1.5">
                      {f.file?.current ? <bdi>{f.file.current.fileName}</bdi> : <span className="text-[#555]">لم يُرفق</span>}
                    </td>
                    <td className="border border-black px-2 py-1.5">{f.file?.current ? formatHijri(f.file.current.createdAt) : empty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10pt]">لا توجد مرفقات.</p>
          )}
        </Section>

        <Section n={fields.length || r.otherValues.length ? 6 : 5} title="قرار الوحدة الإشرافية">
          <Rows
            rows={[
              ["القرار", decision ? <span className="font-bold">{decision.to.name}</span> : "لم يصدر قرار بعد"],
              ["تاريخ القرار", decision ? dual(decision.createdAt) : empty],
              ["المشرف المختص", text(decision?.actor ?? r.assignment?.supervisor?.name ?? null)],
              ["ملاحظات القرار", text(decision?.note)],
            ]}
          />
        </Section>

        {/* The electronic seals and the verification code, kept together on one page. */}
        <section className="doc-keep mt-8">
          <h2 className="mb-3 border-b-2 border-black pb-1 text-[11.5pt] font-bold">الاعتماد والتوقيعات الإلكترونية</h2>
          <div className="grid grid-cols-4 gap-5 text-[9.5pt]">
            {signers.map((s) => (
              <div key={s.role}>
                <p className="text-center font-bold">{s.role}</p>
                <p className="mt-4 border-b border-dotted border-black pb-1">
                  الاسم: <span className="font-semibold">{s.name ?? ""}</span>
                </p>
                <div className="mt-4 min-h-[12mm] border-b border-dotted border-black pb-1">
                  التوقيع: {s.mark ?? <span className="text-[#555]">لم يوقَّع بعد</span>}
                </div>
                <p className="mt-4 border-b border-dotted border-black pb-1">
                  التاريخ: <span className="whitespace-nowrap">{s.date ? formatHijri(s.date, "short") : ""}</span>
                </p>
              </div>
            ))}
            <div className="text-center">
              <p className="font-bold">رمز التحقق</p>
              {certificate ? (
                <>
                  <VerificationQr code={certificate.verifyCode} className="mx-auto mt-2 size-[30mm]" />
                  <p className="mt-1 font-bold tracking-wider">
                    <bdi dir="ltr">{certificate.verifyCode}</bdi>
                  </p>
                </>
              ) : (
                <p className="mt-4 text-[#555]">يصدر بعد الاعتماد النهائي.</p>
              )}
            </div>
          </div>
          {certificate ? (
            <p className="mt-4 border border-black px-3 py-2 text-[9pt] leading-[1.8]">
              وُقِّعت هذه الوثيقة إلكترونيًا من {brand.systemName}، ولا تحتاج إلى توقيع بخط اليد أو ختم. للتحقق من صحتها امسحوا رمز
              التحقق بكاميرا الجوال، أو افتحوا <bdi dir="ltr">{verifyPage}</bdi> وأدخلوا الرمز <bdi dir="ltr">{certificate.verifyCode}</bdi>.
              تفقد الوثيقة صلاحيتها إذا تغيّر الطلب بعد اعتماده.
            </p>
          ) : null}
        </section>
      </article>
    </div>
  );
}
