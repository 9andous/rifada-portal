// Realistic demo data for test deployments: associations with officers, and requests in every
// workflow state with status history, assignments and comments. Every record is flagged isDemo
// (removed by the demo wipe). Needs the base seed and `db:seed:dev-users` to have run first.
// Passwords come from DEV_USERS_PASSWORD; nothing is hard-coded. Safe to re-run: it does nothing
// if the demo associations already exist. Run with `npm run db:seed:demo-data`.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../../src/generated/prisma/client";
import { hijriYear } from "../../src/lib/format";
import { formatReference } from "../../src/lib/requests";
import { createUserWithPassword } from "../../src/server/auth/users";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const ASSOCIATIONS = [
  { name: "جمعية هدية الحاج والمعتمر الخيرية", city: "مكة المكرمة", region: "منطقة مكة المكرمة", classification: "خيرية", username: "demo.hadiya", officer: "عبدالله بن سعيد الغامدي" },
  { name: "جمعية خدمة ضيوف الرحمن", city: "مكة المكرمة", region: "منطقة مكة المكرمة", classification: "خيرية", username: "demo.duyuf", officer: "فهد بن محمد الحربي" },
  { name: "جمعية إكرام ضيوف الرحمن بالمدينة", city: "المدينة المنورة", region: "منطقة المدينة المنورة", classification: "خيرية", username: "demo.ikram", officer: "سلطان بن عبدالعزيز الجهني" },
  { name: "جمعية سقيا الحرمين", city: "مكة المكرمة", region: "منطقة مكة المكرمة", classification: "أهلية", username: "demo.suqya", officer: "ماجد بن أحمد الزهراني" },
  { name: "جمعية رعاية كبار السن من الزوار", city: "المدينة المنورة", region: "منطقة المدينة المنورة", classification: "أهلية", username: "demo.kibar", officer: "نورة بنت خالد العتيبي" },
  { name: "جمعية الإرشاد المكاني للزوار", city: "جدة", region: "منطقة مكة المكرمة", classification: "أهلية", username: "demo.irshad", officer: "ريم بنت عبدالرحمن القرشي" },
];

type Plan = { title: string; description: string; audience: string; location: string; beneficiaries: string; status: string; ageDays: number; comments?: string[] };

const REQUESTS: Plan[] = [
  { title: "برنامج توزيع وجبات الإفطار على المعتمرين", description: "توزيع وجبات إفطار صائم في الساحات الخارجية للمسجد الحرام خلال شهر رمضان بالتنسيق مع الجهات المختصة.", audience: "المعتمرون الصائمون", location: "الساحات الشمالية للمسجد الحرام", beneficiaries: "٢٠٬٠٠٠ معتمر", status: "APPROVED", ageDays: 40, comments: ["نأمل توضيح آلية التنسيق مع إدارة الساحات.", "تم إرفاق خطاب التنسيق، شكرًا لكم."] },
  { title: "مبادرة عربات التنقل لكبار السن وذوي الإعاقة", description: "توفير عربات تنقل مجانية مع متطوعين مدربين لمساعدة كبار السن وذوي الإعاقة في أداء الطواف والسعي.", audience: "كبار السن وذوو الإعاقة", location: "المسجد الحرام", beneficiaries: "٥٬٠٠٠ مستفيد", status: "UNDER_REVIEW", ageDays: 6, comments: ["ما عدد المتطوعين المدربين المتاحين في كل وردية؟"] },
  { title: "مشروع سقيا ماء زمزم في المحطات", description: "تركيب نقاط سقيا متنقلة لماء زمزم في محطات النقل المؤدية إلى المسجد الحرام.", audience: "الزوار والمعتمرون", location: "محطات النقل الترددي", beneficiaries: "٥٠٬٠٠٠ زائر", status: "UNDER_REVIEW", ageDays: 3 },
  { title: "برنامج الإرشاد المكاني متعدد اللغات", description: "فرق إرشاد ميدانية تتحدث ثماني لغات لإرشاد الزوار إلى الأبواب والخدمات.", audience: "الزوار من غير الناطقين بالعربية", location: "محيط المسجد النبوي", beneficiaries: "١٥٬٠٠٠ زائر", status: "RETURNED", ageDays: 12, comments: ["يرجى إرفاق قائمة اللغات وعدد المرشدين لكل لغة قبل إعادة التقديم."] },
  { title: "حملة التوعية الصحية للحجاج", description: "نشر رسائل توعوية صحية ومطويات بعدة لغات عن الإجهاد الحراري والوقاية منه.", audience: "الحجاج", location: "المشاعر المقدسة", beneficiaries: "٣٠٬٠٠٠ حاج", status: "APPROVED", ageDays: 55 },
  { title: "مبادرة هدية الزائر", description: "تقديم هدايا رمزية تعريفية بالمسجد النبوي للزوار عند المغادرة.", audience: "زوار المسجد النبوي", location: "بوابات المسجد النبوي", beneficiaries: "١٠٬٠٠٠ زائر", status: "REJECTED", ageDays: 30, comments: ["تتعارض المبادرة مع ضوابط التوزيع داخل الساحات، لذا اعتذرنا عن قبولها."] },
  { title: "برنامج مظلات التبريد المتنقلة", description: "توفير مظلات ومراوح رذاذ متنقلة في مسارات المشاة خلال أوقات الذروة.", audience: "الزوار المشاة", location: "طريق الهجرة", beneficiaries: "٨٬٠٠٠ زائر يوميًا", status: "DRAFT", ageDays: 1 },
  { title: "برنامج استقبال المعتمرين في المطار", description: "استقبال المعتمرين القادمين وتقديم حقيبة ترحيبية وإرشادهم إلى وسائل النقل.", audience: "المعتمرون القادمون", location: "مطار الملك عبدالعزيز الدولي - صالة الحج والعمرة", beneficiaries: "١٢٬٠٠٠ معتمر", status: "UNDER_REVIEW", ageDays: 9 },
  { title: "مشروع الكراسي المتحركة الكهربائية", description: "إعارة كراسي متحركة كهربائية مع صيانة دورية ونقاط شحن.", audience: "ذوو الإعاقة الحركية", location: "المسجد الحرام - الدور الأرضي", beneficiaries: "٢٬٥٠٠ مستفيد", status: "APPROVED", ageDays: 70 },
  { title: "مبادرة المصلى المتنقل للنساء", description: "تجهيز مصليات متنقلة للنساء قرب مواقف الحافلات في أوقات الازدحام.", audience: "الزائرات", location: "مواقف كدي", beneficiaries: "٦٬٠٠٠ زائرة", status: "DRAFT", ageDays: 2 },
  { title: "برنامج إطعام الزوار في المدينة المنورة", description: "توزيع وجبات جاهزة على الزوار في المنطقة المركزية بالتعاون مع المطاعم الخيرية.", audience: "زوار المدينة المنورة", location: "المنطقة المركزية", beneficiaries: "١٨٬٠٠٠ زائر", status: "UNDER_REVIEW", ageDays: 1 },
  { title: "حملة نظافة الساحات بمشاركة المتطوعين", description: "حملات تطوعية أسبوعية لنظافة الساحات الخارجية بالتنسيق مع الجهات المعنية.", audience: "عموم الزوار", location: "الساحات الجنوبية للمسجد الحرام", beneficiaries: "—", status: "RETURNED", ageDays: 15, comments: ["نحتاج موافقة الجهة المشغلة للساحات قبل المتابعة."] },
];

async function main() {
  const password = process.env.DEV_USERS_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set DEV_USERS_PASSWORD (10+ characters) in .env.");

  if (await db.association.findFirst({ where: { isDemo: true, name: ASSOCIATIONS[0].name } })) {
    console.log("  demo data already present; nothing to do");
    return;
  }

  const statuses = Object.fromEntries((await db.requestStatus.findMany()).map((s) => [s.key, s.id]));
  for (const key of ["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED"]) {
    if (!statuses[key]) throw new Error(`Status ${key} missing; run the base seed first.`);
  }
  const supervisors = await db.user.findMany({ where: { role: "SUPERVISOR" as Role, isActive: true } });
  const manager = await db.user.findFirst({ where: { role: { in: ["UNIT_MANAGER", "SUPER_ADMIN"] as Role[] } } });
  if (!supervisors.length) throw new Error("No supervisor found; run `npm run db:seed:dev-users` first.");

  const tracks = await db.track.findMany({ where: { archivedAt: null }, include: { programs: { include: { program: { include: { initiatives: { where: { isActive: true }, take: 3 } } } } } } });
  const requestTypes = await db.requestType.findMany({ where: { isActive: true } });

  const officers = [];
  for (const [i, a] of ASSOCIATIONS.entries()) {
    const association = await db.association.create({
      data: { name: a.name, city: a.city, region: a.region, classification: a.classification, licenseNumber: `DEMO-${1001 + i}`, contactName: a.officer, contactPhone: `05${String(50000000 + i * 1111111).slice(0, 8)}`, isDemo: true },
    });
    const officer = await createUserWithPassword(db, { username: a.username, name: a.officer, role: "ASSOCIATION_OFFICER", associationId: association.id, password, mustChangePassword: false, isDemo: true });
    officers.push({ association, officer });
    console.log(`  association ${a.name} (${a.username})`);
  }

  for (const [i, plan] of REQUESTS.entries()) {
    const { association, officer } = officers[i % officers.length];
    const supervisor = supervisors[i % supervisors.length];
    const track = tracks.length ? tracks[i % tracks.length] : null;
    const program = track?.programs[i % Math.max(track.programs.length, 1)]?.program ?? null;
    const initiative = program?.initiatives[0] ?? null;
    const created = daysAgo(plan.ageDays + 2);
    const submitted = plan.status === "DRAFT" ? null : daysAgo(plan.ageDays);
    const decided = ["APPROVED", "REJECTED"].includes(plan.status) ? daysAgo(Math.max(plan.ageDays - 7, 0)) : null;

    let referenceNo: string | null = null;
    if (submitted) {
      const year = hijriYear(submitted);
      const rows = await db.$queryRaw<{ lastSeq: number }[]>`
        INSERT INTO "reference_counters" ("hijriYear", "lastSeq") VALUES (${year}, 1)
        ON CONFLICT ("hijriYear") DO UPDATE SET "lastSeq" = "reference_counters"."lastSeq" + 1
        RETURNING "lastSeq"`;
      referenceNo = formatReference(year, Number(rows[0].lastSeq));
    }

    const request = await db.request.create({
      data: {
        referenceNo,
        associationId: association.id,
        trackId: track?.id ?? null,
        requestTypeId: requestTypes.length ? requestTypes[i % requestTypes.length].id : null,
        programId: submitted ? (program?.id ?? null) : null,
        initiativeId: submitted ? (initiative?.id ?? null) : null,
        statusId: statuses[plan.status],
        title: plan.title,
        description: plan.description,
        targetAudience: plan.audience,
        goals: "رفع جودة الخدمات المقدمة لضيوف الرحمن وتحسين تجربتهم.",
        location: plan.location,
        startDate: new Date(Date.now() + 20 * DAY),
        endDate: new Date(Date.now() + 50 * DAY),
        expectedBeneficiaries: plan.beneficiaries,
        kpis: "عدد المستفيدين، نسبة رضا المستفيدين، عدد ساعات التطوع",
        partners: "متطوعون من الجامعات المحلية",
        assignedSupervisorId: submitted ? supervisor.id : null,
        reviewerOpenedAt: submitted && plan.ageDays > 3 ? daysAgo(plan.ageDays - 1) : null,
        createdById: officer.id,
        submittedAt: submitted,
        decidedAt: decided,
        slaDueAt: submitted ? new Date(submitted.getTime() + 14 * DAY) : null,
        isDemo: true,
        createdAt: created,
        ...(initiative && submitted ? { initiatives: { create: { initiativeId: initiative.id } } } : {}),
      },
    });

    if (submitted) {
      const steps: [string | null, string, string | null, Date][] = [
        ["DRAFT", "SUBMITTED", officer.id, submitted],
        ["SUBMITTED", "COMPLETENESS_CHECK", null, submitted],
        ["COMPLETENESS_CHECK", "UNDER_REVIEW", null, submitted],
      ];
      if (plan.status !== "UNDER_REVIEW") steps.push(["UNDER_REVIEW", plan.status, supervisor.id, decided ?? daysAgo(Math.max(plan.ageDays - 3, 0))]);
      for (const [from, to, actorId, at] of steps) {
        await db.requestStatusHistory.create({ data: { requestId: request.id, fromStatusId: from ? statuses[from] : null, toStatusId: statuses[to], actorId, isDemo: true, createdAt: at } });
      }
      await db.assignmentHistory.create({ data: { requestId: request.id, toUserId: supervisor.id, reason: "إسناد تلقائي", isDemo: true, createdAt: submitted } });
    }

    for (const [k, body] of (plan.comments ?? []).entries()) {
      const author = k % 2 === 0 ? (manager && plan.status === "REJECTED" ? manager : supervisor) : officer;
      await db.comment.create({ data: { requestId: request.id, authorId: author.id, body, isDemo: true, createdAt: daysAgo(Math.max(plan.ageDays - 1 - k, 0)) } });
    }
    console.log(`  request ${referenceNo ?? "(draft)"} ${plan.title} [${plan.status}]`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
