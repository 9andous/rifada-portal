// Sample guides and forms for «الأدلة والنماذج» (D-113), so the page can be checked with realistic
// content before the unit publishes its own. Every row is flagged isDemo (removed by the demo wipe
// in Phase 7) and published. The files are one-page placeholder PDFs that say so. Idempotent: a
// sample whose title already exists is skipped. Run with `npm run db:seed:dev-templates`.

import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type TemplateKind } from "../../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

type Sample = { kind: TemplateKind; title: string; description: string; fileName: string; program?: number; initiative?: number; attachmentType?: string };

const SAMPLES: Sample[] = [
  {
    kind: "GUIDE",
    title: "دليل الجمعيات لتقديم الطلبات عبر منصة رفادة",
    description: "خطوات تقديم الطلب من اختيار البرنامج والمبادرة إلى إرفاق المستندات ومتابعة الطلب، مع أمثلة لكل خطوة.",
    fileName: "rifada-association-guide.pdf",
  },
  {
    kind: "GUIDE",
    title: "معايير القبول والامتثال للبرامج والمبادرات",
    description: "المعايير التي تراجع بها الوحدة الإشرافية كل طلب: مطابقة النشاط لاختصاص الرئاسة، وملاءمته لقدسية المكان، ومصفوفة الصلاحيات، والارتباط بالأهداف الاستراتيجية، وخطة القياس.",
    fileName: "acceptance-criteria.pdf",
  },
  {
    kind: "GUIDE",
    title: "دليل إعداد تقارير القياس والأثر",
    description: "كيف تحدد الجمعية مؤشرات القياس ودورية التقارير ومنهجية جمع البيانات، مع نموذج تقرير مقترح.",
    fileName: "impact-reporting-guide.pdf",
  },
  {
    kind: "FORM",
    title: "نموذج خطاب الطلب الرسمي",
    description: "خطاب موجّه إلى الوحدة الإشرافية يوقّعه رئيس مجلس إدارة الجمعية أو من يفوضه، ويُختم بختم الجمعية.",
    fileName: "official-request-letter.pdf",
    attachmentType: "خطاب الطلب الرسمي",
  },
  {
    kind: "FORM",
    title: "نموذج خطة البرنامج",
    description: "أهداف البرنامج والفئة المستهدفة والأنشطة والموارد المطلوبة ومؤشرات النجاح.",
    fileName: "program-plan.pdf",
    attachmentType: "خطة البرنامج",
  },
  {
    kind: "FORM",
    title: "نموذج الجدول الزمني للتنفيذ",
    description: "مراحل التنفيذ وتواريخ البدء والانتهاء لكل نشاط، والمسؤول عنه.",
    fileName: "implementation-timeline.pdf",
    attachmentType: "الجدول الزمني للتنفيذ",
  },
  {
    kind: "GUIDE",
    title: "دليل الضوابط الميدانية داخل المسجد الحرام والمسجد النبوي",
    description: "ضوابط العمل الميداني والسلوك والمظهر وأماكن الوقوف المسموح بها، وما يُراعى من قدسية المكان.",
    fileName: "field-conduct-guide.pdf",
    program: 6,
  },
  {
    kind: "FORM",
    title: "نموذج مصفوفة الصلاحيات والمسؤوليات الميدانية",
    description: "اسم المسؤول الميداني المعتمد لكل موقع، وصلاحياته، وطريقة التواصل معه أثناء التنفيذ.",
    fileName: "field-responsibility-matrix.pdf",
    program: 6,
    attachmentType: "مستندات داعمة",
  },
  {
    kind: "FORM",
    title: "نموذج السيرة الذاتية للمدرب",
    description: "المؤهلات والخبرات والدورات السابقة للمدرب أو المعلم المشارك في البرنامج.",
    fileName: "trainer-cv.pdf",
    program: 7,
    attachmentType: "السير الذاتية للمدربين والمعلمين",
  },
  {
    kind: "FORM",
    title: "نموذج خطة حلقة تحفيظ",
    description: "عدد الطلاب ومستوياتهم، وأوقات الحلقة ومكانها، والمقدار المستهدف حفظه ومراجعته.",
    fileName: "quran-circle-plan.pdf",
    program: 5,
    initiative: 3,
    attachmentType: "خطة البرنامج",
  },
  {
    kind: "GUIDE",
    title: "دليل إجراءات الإشراف الفني على الجمعيات",
    description: "مرجع الحوكمة الدائم.",
    fileName: "supervision-procedures-guide.pdf",
  },
  {
    kind: "FORM",
    title: "نموذج طلب اعتماد برنامج",
    description: "مرتبط بمسار الطلبات في المنصة.",
    fileName: "program-approval-request.pdf",
  },
  {
    kind: "GUIDE",
    title: "مصفوفة الصلاحيات والمسؤوليات",
    description: "قيد المراجعة مع الإدارة القانونية.",
    fileName: "authority-matrix.pdf",
  },
  {
    kind: "GUIDE",
    title: "معايير القبول والامتثال",
    description: "خمسة معايير مطبقة آليًا على كل طلب.",
    fileName: "acceptance-compliance-criteria.pdf",
  },
  {
    kind: "GUIDE",
    title: "تقرير المقارنة المعيارية لأفضل الممارسات",
    description: "دراسة الجهات المشرفة فنيًا.",
    fileName: "benchmarking-report.pdf",
  },
  {
    kind: "FORM",
    title: "نموذج تقرير الأثر الدوري للجمعيات",
    description: "يغذي لوحات القياس تلقائيًا.",
    fileName: "periodic-impact-report.pdf",
  },
];

/** A one-page PDF with two lines of Latin text: Arabic would need an embedded font. */
function placeholderPdf(label: string): Buffer {
  const text = `BT /F1 20 Tf 72 720 Td (Rifada - sample file) Tj 0 -32 Td /F1 12 Tf (${label}) Tj 0 -20 Td (Placeholder for development; replace with the real document.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function main() {
  const admin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) throw new Error("Run `npm run db:seed` first: the samples are recorded as uploaded by the super admin.");
  const root = path.resolve(process.env.STORAGE_DIR || "./storage");

  for (const s of SAMPLES) {
    if (await db.template.findFirst({ where: { title: s.title, isDemo: true } })) {
      console.log(`  ${s.fileName} already exists`);
      continue;
    }
    const program = s.program ? await db.program.findFirst({ where: { number: s.program }, select: { id: true } }) : null;
    const initiative =
      program && s.initiative ? await db.initiative.findFirst({ where: { programId: program.id, number: s.initiative, archivedAt: null }, select: { id: true } }) : null;
    const type = s.attachmentType ? await db.attachmentType.findFirst({ where: { name: s.attachmentType, archivedAt: null }, select: { id: true } }) : null;

    const bytes = placeholderPdf(s.fileName);
    const storageKey = `templates/${randomBytes(16).toString("hex")}`;
    await mkdir(path.join(root, "templates"), { recursive: true });
    await writeFile(path.join(root, ...storageKey.split("/")), bytes, { flag: "wx" });
    const file = { storageKey, fileName: s.fileName, mime: "application/pdf", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };

    await db.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: { kind: s.kind, title: s.title, description: s.description, programId: program?.id, initiativeId: initiative?.id, attachmentTypeId: type?.id, ...file, isPublished: true, isDemo: true },
      });
      const version = await tx.templateFile.create({ data: { templateId: template.id, versionNo: 1, ...file, uploadedById: admin.id } });
      await tx.template.update({ where: { id: template.id }, data: { currentFileId: version.id } });
    });
    console.log(`  created ${s.fileName}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
