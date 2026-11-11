// Rebuilds a test deployment as a rich demo (D-148): removes every test account, association, request and
// audit row, keeps `admin`, the foundation's record and logo, taxonomy, templates and settings, then writes the
// people and requests of rich-demo-data.ts in every state of the review, with real seals and real files.
//
// Destructive, including the audit log: for test deployments only. Back up first.
// Run with `CONFIRM_RICH_DEMO_RESET=yes npm run db:seed:rich-demo`. The password of every new account is
// DEV_USERS_PASSWORD; `admin` keeps its own.

import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { crc32 } from "node:zlib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import { REVIEW_CRITERIA } from "../../src/config/review-criteria";
import { hashPassword } from "../../src/server/auth/password";
import { createUserWithPasswordHash } from "../../src/server/auth/users";
import { hijriYear } from "../../src/lib/format";
import { formatReference, requestHref, RECOMMENDATION_LABELS, RECOMMENDATION_VALUES, type Decision } from "../../src/lib/requests";
import { addWorkingDays } from "../../src/lib/working-days";
import { contentDigest, createSeal, evaluationDigest, openSeal } from "../../src/server/seal/seal";
import { CARRIED_SPECS } from "./rich-demo-carried";
import { ASSOCIATIONS, EXTRA_SPECS, FOUNDATION_NAME, FOUNDATION_SPECS, MANAGER, REGISTRATIONS, SUPERVISORS, type Content, type Spec } from "./rich-demo-data";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const SPECS: Spec[] = [...FOUNDATION_SPECS, ...CARRIED_SPECS, ...EXTRA_SPECS];
const SLA_WORKING_DAYS = 3;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.now();
const STORAGE = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const daysAgo = (n: number) => new Date(NOW - n * DAY);
const after = (d: Date, hours: number) => new Date(d.getTime() + hours * HOUR);
const list = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");
const body = (c: Content) => [c.intro, `الوسائل وآليات التنفيذ\n${list(...c.means)}`, ...(c.projects ? [`المشاريع والنماذج المنبثقة\n${list(...c.projects)}`] : [])].join("\n\n");

// ---------------------------------------------------------------------------
// Real Word files for the attachments, written out of the request's own content
// ---------------------------------------------------------------------------

function zip(files: [string, string][]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, "utf8");
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function docx(lines: { text: string; bold?: boolean }[]): Buffer {
  const paragraphs = lines
    .map((l) => `<w:p><w:pPr><w:bidi/><w:jc w:val="start"/></w:pPr><w:r><w:rPr>${l.bold ? "<w:b/><w:bCs/>" : ""}<w:rtl/><w:szCs w:val="${l.bold ? 28 : 24}"/></w:rPr><w:t xml:space="preserve">${xml(l.text)}</w:t></w:r></w:p>`)
    .join("");
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ["word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`],
  ]);
}

const section = (title: string, items: string[]) => [{ text: title, bold: true }, ...items.map((text) => ({ text: `• ${text}` }))];

function planFile(spec: Spec, association: string, version: number) {
  const c = spec.content;
  return docx([
    { text: `خطة البرنامج: ${spec.title}`, bold: true },
    { text: `الجهة: ${association}` },
    ...(version > 1 ? [{ text: `الإصدار ${version}، بعد استكمال ما طلبته الوحدة.` }] : []),
    { text: "فكرة البرنامج", bold: true },
    { text: c.intro },
    ...section("الأهداف", c.goals),
    ...section("الفئات المستهدفة", c.audience),
    ...section("الوسائل", c.means),
    ...(c.projects ? section("المشاريع", c.projects) : []),
    ...section("مؤشرات النجاح", c.kpis),
    ...(c.partners.length ? section("الشركاء", c.partners) : []),
    { text: "وثيقة توضيحية أُعدت لأغراض العرض." },
  ]);
}

function timelineFile(spec: Spec, start: Date, end: Date) {
  const step = (end.getTime() - start.getTime()) / 4;
  const day = (i: number) => new Date(start.getTime() + i * step).toISOString().slice(0, 10);
  const stages = ["الإعداد وإبرام الشراكات", "التصميم والمراجعة العلمية", "التشغيل مع الجهات الشريكة", "القياس وإعداد تقرير الأثر"];
  return docx([{ text: `الجدول الزمني: ${spec.title}`, bold: true }, ...stages.map((s, i) => ({ text: `المرحلة ${i + 1}: ${s} (من ${day(i)} إلى ${day(i + 1)}م)` })), { text: "وثيقة توضيحية أُعدت لأغراض العرض." }]);
}

function matrixFile(spec: Spec, officer: string) {
  return docx([
    { text: `مصفوفة الصلاحيات والمسؤوليات: ${spec.title}`, bold: true },
    { text: `مسؤول الطلب: ${officer}` },
    ...section("المسؤوليات", ["المالك العلمي للمحتوى: مسؤول الجهة.", "التشغيل الميداني: الجهة الشريكة المقتدرة.", "القياس وإعداد التقارير: وحدة الجودة لدى الجهة."]),
    { text: "وثيقة توضيحية أُعدت لأغراض العرض." },
  ]);
}

async function saveFile(data: Buffer) {
  const storageKey = `attachments/${randomBytes(16).toString("hex")}`;
  await mkdir(path.join(STORAGE, "attachments"), { recursive: true });
  await writeFile(path.join(STORAGE, ...storageKey.split("/")), data);
  return { storageKey, mime: DOCX, size: data.length, sha256: createHash("sha256").update(data).digest("hex") };
}

// ---------------------------------------------------------------------------

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run the demo reset with NODE_ENV=production.");
  if (process.env.CONFIRM_RICH_DEMO_RESET !== "yes") throw new Error("This deletes every test record, including audit rows. Back up, then set CONFIRM_RICH_DEMO_RESET=yes.");
  const password = process.env.DEV_USERS_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set DEV_USERS_PASSWORD (10+ characters).");
  const passwordHash = await hashPassword(password);

  const summary = await db.$transaction(
    async (tx) => {
      const admin = await tx.user.findUniqueOrThrow({ where: { username: "admin" }, select: { id: true } });
      const foundation = await tx.association.findFirstOrThrow({ where: { name: FOUNDATION_NAME }, select: { id: true } });

      // --- The reset ----------------------------------------------------------------------------------------
      const removed = {
        notifications: (await tx.notification.deleteMany()).count,
        requests: (await tx.request.deleteMany()).count,
        registrations: (await tx.associationRegistration.deleteMany()).count,
        auditRows: (await tx.auditLog.deleteMany()).count,
        users: (await tx.user.deleteMany({ where: { id: { not: admin.id } } })).count,
        associations: (await tx.association.deleteMany({ where: { id: { not: foundation.id } } })).count,
        junkRequirements: (await tx.initiativeRequirement.deleteMany({ where: { key: "do_this" } })).count,
      };
      await tx.referenceCounter.deleteMany();
      await tx.sealCounter.deleteMany();
      await tx.user.update({ where: { id: admin.id }, data: { avatarKey: null } });

      // --- People -------------------------------------------------------------------------------------------
      const account = async (u: { username: string; name: string; phone: string; role: "UNIT_MANAGER" | "SUPERVISOR" | "ASSOCIATION_OFFICER"; associationId?: string; isActive: boolean; createdAt: Date }) => {
        const user = await createUserWithPasswordHash(tx, { username: u.username, name: u.name, role: u.role, phone: u.phone, associationId: u.associationId, passwordHash, mustChangePassword: false, isDemo: true });
        await tx.user.update({ where: { id: user.id }, data: { isActive: u.isActive, createdAt: u.createdAt } });
        await tx.auditLog.create({ data: { actorId: admin.id, action: "user.created", entityType: "User", entityId: user.id, after: { username: u.username, name: u.name, role: u.role }, createdAt: u.createdAt } });
        if (!u.isActive) await tx.auditLog.create({ data: { actorId: admin.id, action: "user.deactivated", entityType: "User", entityId: user.id, after: { username: u.username, name: u.name }, createdAt: daysAgo(90) } });
        return { ...user, isActive: u.isActive };
      };

      const onboarded = daysAgo(240);
      const manager = await account({ ...MANAGER, role: "UNIT_MANAGER", isActive: true, createdAt: onboarded });
      const tracks = new Map((await tx.track.findMany({ where: { archivedAt: null }, select: { id: true, number: true, programs: { select: { programId: true } } } })).map((t) => [t.number, t]));
      const staff = new Map<string, { id: string; role: string; name: string }>();
      const trackSupervisor = new Map<number, string>();
      for (const s of SUPERVISORS) {
        const user = await account({ ...s, role: "SUPERVISOR", createdAt: onboarded });
        staff.set(s.username, user);
        for (const number of s.tracks) {
          await tx.supervisorTrack.create({ data: { userId: user.id, trackId: tracks.get(number)!.id } });
          if (!trackSupervisor.has(number)) trackSupervisor.set(number, s.username);
        }
      }

      const officers = new Map<string, { id: string; role: string; name: string; associationId: string; associationName: string }>();
      for (const [i, a] of ASSOCIATIONS.entries()) {
        const data = { name: a.name, licenseNumber: a.license, city: a.city, region: a.region, classification: a.classification, contactName: a.officer, contactPhone: `05000002${String(i + 1).padStart(2, "0")}`, isActive: a.isActive, isDemo: true };
        const created = "fresh" in a ? daysAgo(5) : daysAgo(230 - i * 3);
        const row = a.name === FOUNDATION_NAME ? await tx.association.update({ where: { id: foundation.id }, data: { ...data, createdAt: created } }) : await tx.association.create({ data: { ...data, createdAt: created } });
        await tx.auditLog.create({ data: { actorId: admin.id, action: "association.created", entityType: "Association", entityId: row.id, after: { name: a.name, licenseNumber: a.license, city: a.city }, createdAt: created } });
        if (!a.isActive) await tx.auditLog.create({ data: { actorId: admin.id, action: "association.deactivated", entityType: "Association", entityId: row.id, after: { name: a.name }, createdAt: daysAgo(60) } });
        const user = await account({ username: a.username, name: a.officer, phone: data.contactPhone, role: "ASSOCIATION_OFFICER", associationId: row.id, isActive: a.isActive, createdAt: created });
        officers.set(a.username, { id: user.id, role: "ASSOCIATION_OFFICER", name: a.officer, associationId: row.id, associationName: a.name });
      }

      // Past sign-ins: everyone active but the association that just joined.
      const signIns = [{ id: manager.id, username: MANAGER.username, active: true }, ...SUPERVISORS.map((s) => ({ id: staff.get(s.username)!.id, username: s.username, active: s.isActive })), ...ASSOCIATIONS.filter((a) => !("fresh" in a)).map((a) => ({ id: officers.get(a.username)!.id, username: a.username, active: a.isActive }))];
      for (const [i, s] of signIns.entries()) {
        const times = s.active ? [1 + (i % 3), 6 + (i % 5), 15 + (i % 7), 28 + (i % 9)].map(daysAgo) : [daysAgo(95 + i)];
        for (const at of times) await tx.auditLog.create({ data: { actorId: s.id, action: "auth.login", entityType: "Session", createdAt: at } });
        await tx.user.update({ where: { id: s.id }, data: { lastLoginAt: times[0] } });
      }

      // --- Applications -------------------------------------------------------------------------------------
      for (const r of REGISTRATIONS) {
        const at = daysAgo(r.ageDays);
        const decided = r.status !== "PENDING";
        const row = await tx.associationRegistration.create({
          data: {
            referenceNo: r.referenceNo,
            status: r.status,
            name: r.name,
            licenseNumber: r.license,
            classification: r.classification,
            region: r.region,
            city: r.city,
            foundedYear: r.foundedYear,
            contactPhone: "0500000301",
            officerName: r.officer,
            officerUsername: r.username,
            officerPhone: "0500000302",
            passwordHash: decided ? null : passwordHash,
            pledgeAcceptedAt: at,
            decisionNote: "note" in r ? r.note : null,
            reviewedById: decided ? admin.id : null,
            reviewedAt: decided ? after(at, 26) : null,
            associationId: r.status === "APPROVED" ? officers.get(r.username)!.associationId : null,
            createdAt: at,
          },
        });
        await tx.auditLog.create({ data: { actorId: null, action: "registration.submitted", entityType: "AssociationRegistration", entityId: row.id, after: { referenceNo: r.referenceNo, name: r.name }, createdAt: at } });
        if (decided) await tx.auditLog.create({ data: { actorId: admin.id, action: r.status === "APPROVED" ? "registration.approved" : "registration.rejected", entityType: "AssociationRegistration", entityId: row.id, after: { referenceNo: r.referenceNo, name: r.name }, createdAt: after(at, 26) } });
      }

      // --- Requests -----------------------------------------------------------------------------------------
      const statuses = Object.fromEntries((await tx.requestStatus.findMany({ select: { id: true, key: true } })).map((s) => [s.key, s.id]));
      const types = new Map((await tx.requestType.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
      const fileTypes = new Map((await tx.attachmentType.findMany({ select: { id: true, key: true } })).map((t) => [t.key, t.id]));
      const seqByYear = new Map<number, number>();
      const created: string[] = [];
      const counts: Record<string, number> = {};
      const ordered = [...SPECS].sort((a, b) => ("ageDays" in b.plan ? b.plan.ageDays : -1) - ("ageDays" in a.plan ? a.plan.ageDays : -1));

      for (const [index, spec] of ordered.entries()) {
        const plan = spec.plan;
        counts[plan.state] = (counts[plan.state] ?? 0) + 1;
        const officer = officers.get(spec.officer);
        const track = tracks.get(spec.track);
        const requestTypeId = types.get(spec.type);
        if (!officer || !track || !requestTypeId) throw new Error(`Officer, track or type missing for «${spec.title}».`);

        const ageDays = "ageDays" in plan ? plan.ageDays : 2;
        const submitted = plan.state === "DRAFT" ? null : new Date(daysAgo(ageDays).getTime() - (plan.state === "NEW" ? 2 : 6) * HOUR);
        let referenceNo: string | null = null;
        if (submitted) {
          const year = hijriYear(submitted);
          const seq = (seqByYear.get(year) ?? 0) + 1;
          seqByYear.set(year, seq);
          referenceNo = formatReference(year, seq);
          await tx.referenceCounter.upsert({ where: { hijriYear: year }, create: { hijriYear: year, lastSeq: seq }, update: { lastSeq: seq } });
        }

        // Who holds it: the track's supervisor, another one who signed instead, or one the manager moved it to.
        const firstName = trackSupervisor.get(spec.track)!;
        const unassigned = plan.state === "UNASSIGNED";
        const holderName = spec.reassign?.to ?? spec.reviewer ?? firstName;
        const first = staff.get(spec.reviewer === "sup.former" ? "sup.former" : firstName)!;
        const holder = staff.get(holderName)!;

        const start = spec.dates ? new Date(`${spec.dates[0]}T00:00:00Z`) : new Date((submitted ?? daysAgo(2)).getTime() + (30 + (index % 5) * 7) * DAY);
        const end = spec.dates ? new Date(`${spec.dates[1]}T00:00:00Z`) : new Date(start.getTime() + (90 + (index % 5) * 30) * DAY);
        const opened = plan.state !== "DRAFT" && plan.state !== "NEW" && plan.state !== "UNASSIGNED" && submitted ? after(submitted, 2) : null;
        const createdAt = submitted ? new Date(submitted.getTime() - 3 * DAY) : daysAgo(2 + (index % 4));

        const request = await tx.request.create({
          data: {
            referenceNo,
            associationId: officer.associationId,
            trackId: track.id,
            requestTypeId,
            statusId: statuses.UNDER_REVIEW,
            title: spec.title,
            description: body(spec.content),
            goals: list(...spec.content.goals),
            expectedBeneficiaries: spec.content.audience.join("\n"),
            kpis: spec.content.kpis.join("\n"),
            partners: spec.content.partners.join("، ") || null,
            estimatedBudget: spec.content.budget || null,
            startDate: start,
            endDate: end,
            requirementsSnapshot: [],
            createdById: officer.id,
            assignedSupervisorId: submitted && !unassigned ? holder.id : null,
            reviewerOpenedAt: opened,
            submittedAt: submitted,
            slaDueAt: submitted ? addWorkingDays(submitted, SLA_WORKING_DAYS) : null,
            lastActivityAt: submitted ?? createdAt,
            createdAt,
            isDemo: true,
          },
        });

        const ref = { referenceNo, title: spec.title };
        const label = `${referenceNo ?? ""} — ${spec.title}`;
        let last = submitted ?? createdAt;
        const log = (actorId: string | null, action: string, at: Date, extra: Prisma.InputJsonObject = {}) => tx.auditLog.create({ data: { actorId, action, entityType: "Request", entityId: request.id, after: { ...ref, ...extra }, createdAt: at } });
        const notify = (u: { id: string; role: string }, type: string, title: string, at: Date) =>
          tx.notification.create({ data: { userId: u.id, type, title, body: label, link: requestHref(u.role as "SUPERVISOR", request.id), requestId: request.id, createdAt: at, readAt: at.getTime() < NOW - 7 * DAY ? after(at, 5) : null, isDemo: true } });
        const status = (from: string, to: string, actorId: string | null, at: Date, note: string | null = null) => tx.requestStatusHistory.create({ data: { requestId: request.id, fromStatusId: statuses[from], toStatusId: statuses[to], actorId, note, createdAt: at, isDemo: true } });

        await log(officer.id, "request.created", createdAt);

        // Files: a plan on nearly everything, then a timeline and a responsibility matrix on many.
        const twoVersions = plan.state === "RESUBMITTED" || plan.state === "TWO_ROUNDS";
        const attach = async (typeKey: string, fileName: string, makers: (() => Buffer)[]) => {
          const attachment = await tx.attachment.create({ data: { ownerType: "REQUEST", requestId: request.id, attachmentTypeId: fileTypes.get(typeKey), title: fileName, uploadedById: officer.id, createdAt, isDemo: true } });
          let currentVersionId = "";
          for (const [i, make] of makers.entries()) {
            const at = i === 0 ? after(createdAt, 1) : (submitted ?? createdAt);
            const version = await tx.attachmentVersion.create({ data: { attachmentId: attachment.id, versionNo: i + 1, fileName, uploadedById: officer.id, createdAt: at, isDemo: true, ...(await saveFile(make())) } });
            currentVersionId = version.id;
            await log(officer.id, i === 0 ? "request.file_added" : "request.file_version_added", at, { fileName, version: i + 1 });
          }
          await tx.attachment.update({ where: { id: attachment.id }, data: { currentVersionId } });
        };
        if (plan.state !== "DRAFT" || index % 2 === 0) {
          const makers = [() => planFile(spec, officer.associationName, 1), ...(twoVersions ? [() => planFile(spec, officer.associationName, 2)] : [])];
          await attach("program_plan", "خطة البرنامج.docx", makers);
        }
        if (submitted && index % 3 !== 2) await attach("execution_timeline", "الجدول الزمني للتنفيذ.docx", [() => timelineFile(spec, start, end)]);
        if (submitted && index % 3 === 0) await attach("supporting_documents", "مصفوفة الصلاحيات والمسؤوليات.docx", [() => matrixFile(spec, officer.name)]);

        if (plan.state === "DRAFT") {
          await tx.request.update({ where: { id: request.id }, data: { statusId: statuses.DRAFT } });
          await log(officer.id, "request.saved", after(createdAt, 2));
          created.push(`DRAFT — ${spec.title}`);
          continue;
        }

        const at0 = submitted!;
        await status("DRAFT", "SUBMITTED", officer.id, at0);
        await status("SUBMITTED", "COMPLETENESS_CHECK", null, at0);
        await tx.completenessCheck.create({ data: { requestId: request.id, passed: true, missing: [], ranBy: "RULES", createdAt: at0, isDemo: true } });
        await status("COMPLETENESS_CHECK", "UNDER_REVIEW", null, at0, "اجتاز فحص الاكتمال");
        await log(officer.id, "request.submitted", at0);

        if (unassigned) {
          await tx.assignmentHistory.create({ data: { requestId: request.id, reason: "كان مشرف المسار موقوفًا وقت الإرسال", createdAt: at0, isDemo: true } });
          await log(null, "request.left_unassigned", at0);
          await notify(manager, "request.unassigned", "طلب بلا مشرف متاح", at0);
        } else {
          await tx.assignmentHistory.create({ data: { requestId: request.id, toUserId: first.id, reason: "إسناد تلقائي", createdAt: at0, isDemo: true } });
          await log(null, "request.auto_assigned", at0, { assignedSupervisorId: first.id });
          await notify(first, "request.assigned", "أُسند إليك طلب للمراجعة", at0);
        }
        if (spec.reassign) {
          const at = after(at0, 1);
          await tx.assignmentHistory.create({ data: { requestId: request.id, fromUserId: first.id, toUserId: holder.id, actorId: manager.id, reason: spec.reassign.reason, createdAt: at, isDemo: true } });
          await log(manager.id, "request.reassigned", at, { assignedSupervisorId: holder.id, reason: spec.reassign.reason });
          await notify(holder, "request.assigned", "أُسند إليك طلب للمراجعة", at);
          await notify(first, "request.reassigned_away", "نُقل طلب كان مسندًا إليك", at);
        }

        // The supervisor classifies once, then evaluates and sends it to the unit manager.
        let classified = false;
        const evaluate = async (signer: { id: string }, recommendation: Decision, reason: string | null, note: string | null, unmet: string[], at: Date) => {
          if (spec.scope && !classified) {
            classified = true;
            const [programNumber, ...initiativeNumbers] = spec.scope;
            const program = await tx.program.findFirst({ where: { number: programNumber, id: { in: track.programs.map((p) => p.programId) } }, select: { id: true, number: true, name: true } });
            if (!program) throw new Error(`Programme ${programNumber} is not on track ${spec.track} for «${spec.title}».`);
            const initiatives = [];
            for (const number of initiativeNumbers) {
              const initiative = await tx.initiative.findFirst({ where: { programId: program.id, number, archivedAt: null }, select: { id: true, number: true, name: true } });
              if (!initiative) throw new Error(`Initiative ${programNumber}/${number} is missing for «${spec.title}».`);
              initiatives.push(initiative);
            }
            await tx.request.update({ where: { id: request.id }, data: { programId: program.id, initiativeId: initiatives[0].id } });
            for (const [sortOrder, initiative] of initiatives.entries()) await tx.requestInitiative.create({ data: { requestId: request.id, initiativeId: initiative.id, sortOrder } });
            const scopeAfter = { program: { number: program.number, name: program.name }, initiatives: initiatives.map((i) => ({ number: i.number, name: i.name })) };
            await tx.requestScopeChange.create({ data: { requestId: request.id, actorId: signer.id, before: { program: null, initiatives: [] }, after: scopeAfter, createdAt: after(at, -1) } });
            await log(signer.id, "request.scope_changed", after(at, -1), scopeAfter);
          }
          const criteria = REVIEW_CRITERIA.map((c) => ({ key: c.key, met: !unmet.includes(c.key), note: unmet.includes(c.key) ? (reason ?? note ?? "") : "" }));
          const evaluation = await tx.requestEvaluation.create({ data: { requestId: request.id, reviewerId: signer.id, criteria, note, recommendation: RECOMMENDATION_VALUES[recommendation], reason, createdAt: at } });
          const seal = await createSeal(tx, { kind: "EVALUATION", requestId: request.id, signerId: signer.id, evaluationId: evaluation.id, at });
          await tx.request.update({ where: { id: request.id }, data: { reviewStage: "MANAGER" } });
          await log(signer.id, "request.evaluated", at, { seal: seal.serial, recommendation, reason, criteriaMet: criteria.filter((c) => c.met).length, criteriaTotal: criteria.length });
          await notify(manager, "request.evaluated", `طلب بانتظار قراركم — توصية المشرف: ${RECOMMENDATION_LABELS[recommendation]}`, at);
          return evaluation.id;
        };
        const takeOver = async (at: Date) => {
          if (!spec.reviewer || spec.reviewer === firstName || spec.reviewer === "sup.former") return;
          await tx.assignmentHistory.create({ data: { requestId: request.id, fromUserId: first.id, toUserId: holder.id, actorId: holder.id, reason: "وقّع التقييم مشرف آخر من المسار", createdAt: at, isDemo: true } });
          await notify(first, "request.reassigned_away", "تولى مشرف آخر طلبًا كان مسندًا إليك", at);
        };
        const decide = async (decision: Decision, reason: string | null, at: Date, recommendation: Decision) => {
          const to = decision === "approve" ? "APPROVED" : decision === "return" ? "RETURNED" : "REJECTED";
          await tx.request.update({ where: { id: request.id }, data: { statusId: statuses[to], reviewStage: "SUPERVISOR", decidedAt: to === "RETURNED" ? null : at } });
          await status("UNDER_REVIEW", to, manager.id, at, reason);
          if (decision === "approve") {
            const approval = await tx.requestApproval.create({ data: { requestId: request.id, managerId: manager.id, createdAt: at } });
            await createSeal(tx, { kind: "APPROVAL", requestId: request.id, signerId: manager.id, approvalId: approval.id, at });
          }
          const verb = decision === "approve" ? "approved" : decision === "return" ? "returned" : "rejected";
          await log(manager.id, `request.${verb}`, at, { status: to, reason, recommendation: RECOMMENDATION_VALUES[recommendation] });
          await notify(officer, `request.${verb}`, decision === "approve" ? "اعتُمد طلبكم" : decision === "return" ? "أُعيد طلبكم للتعديل" : "رُفض طلبكم", at);
          await notify(holder, "request.manager_decided", `قرار مدير الوحدة: ${decision === "approve" ? "اعتماد الطلب" : decision === "return" ? "إعادته إلى الجمعية للتعديل" : "رفض الطلب"}`, at);
        };

        if (plan.state === "OPENED") {
          if (plan.overdue) await tx.request.update({ where: { id: request.id }, data: { slaDueAt: daysAgo(1) } });
        } else if (plan.state === "RESUBMITTED") {
          const returned = after(at0, -30);
          const back = after(at0, 3);
          await tx.requestStatusHistory.updateMany({ where: { requestId: request.id }, data: { createdAt: after(at0, -48) } });
          await tx.request.update({ where: { id: request.id }, data: { submittedAt: after(at0, -48), resubmittedAt: back, slaDueAt: addWorkingDays(back, SLA_WORKING_DAYS), reviewerOpenedAt: null } });
          await status("UNDER_REVIEW", "RETURNED", holder.id, returned, plan.returnedReason);
          await log(holder.id, "request.returned", returned, { status: "RETURNED", reason: plan.returnedReason });
          await status("RETURNED", "SUBMITTED", officer.id, back);
          await status("SUBMITTED", "COMPLETENESS_CHECK", null, back);
          await status("COMPLETENESS_CHECK", "UNDER_REVIEW", null, back, "اجتاز فحص الاكتمال");
          await log(officer.id, "request.resubmitted", back);
          await notify(holder, "request.resubmitted", "أُعيد تقديم طلب بعد التعديل", back);
          last = back;
        } else if (plan.state === "RETURNED_DIRECT" || plan.state === "REJECTED_DIRECT") {
          const to = plan.state === "RETURNED_DIRECT" ? "RETURNED" : "REJECTED";
          const at = after(at0, 20);
          await tx.request.update({ where: { id: request.id }, data: { statusId: statuses[to], decidedAt: to === "REJECTED" ? at : null } });
          await status("UNDER_REVIEW", to, holder.id, at, plan.reason);
          await log(holder.id, to === "RETURNED" ? "request.returned" : "request.rejected", at, { status: to, reason: plan.reason });
          await notify(officer, to === "RETURNED" ? "request.returned" : "request.rejected", to === "RETURNED" ? "أُعيد طلبكم للتعديل" : "رُفض طلبكم", at);
          last = at;
        } else if (plan.state === "WITH_MANAGER") {
          const at = after(at0, 20);
          await takeOver(after(at, -1));
          await evaluate(holder, plan.recommendation, plan.reason ?? null, plan.note ?? null, plan.unmet ?? [], at);
          last = at;
        } else if (plan.state === "DECIDED") {
          const evaluated = after(at0, 24);
          const decided = after(at0, 48);
          await takeOver(after(evaluated, -1));
          const evaluationId = await evaluate(holder, plan.recommendation, plan.recommendationReason ?? null, plan.note ?? null, plan.unmet ?? [], evaluated);
          if (spec.managerEdit) {
            const edited = after(evaluated, 12);
            await tx.requestEvaluation.update({ where: { id: evaluationId }, data: { note: `${plan.note ?? ""} ${spec.managerEdit}`.trim(), editedById: manager.id, editedAt: edited } });
            await log(manager.id, "request.evaluation_edited", edited);
            await notify(holder, "request.evaluation_edited", "عدّل مدير الوحدة تقييمك", edited);
          }
          await decide(plan.decision, plan.reason ?? null, decided, plan.recommendation);
          last = decided;
        } else if (plan.state === "TWO_ROUNDS") {
          // Round one: returned directly by the supervisor. Round two: evaluated and decided.
          const originallySent = after(at0, -96);
          await tx.requestStatusHistory.updateMany({ where: { requestId: request.id }, data: { createdAt: originallySent } });
          const returned = after(at0, -72);
          await status("UNDER_REVIEW", "RETURNED", holder.id, returned, plan.firstReason);
          await log(holder.id, "request.returned", returned, { status: "RETURNED", reason: plan.firstReason });
          await notify(officer, "request.returned", "أُعيد طلبكم للتعديل", returned);
          await status("RETURNED", "SUBMITTED", officer.id, at0);
          await status("SUBMITTED", "COMPLETENESS_CHECK", null, at0);
          await status("COMPLETENESS_CHECK", "UNDER_REVIEW", null, at0, "اجتاز فحص الاكتمال");
          await tx.request.update({ where: { id: request.id }, data: { submittedAt: originallySent, resubmittedAt: at0 } });
          await log(officer.id, "request.resubmitted", at0);
          await notify(holder, "request.resubmitted", "أُعيد تقديم طلب بعد التعديل", at0);
          await evaluate(holder, plan.recommendation, plan.recommendation === "approve" ? null : (plan.reason ?? plan.note ?? null), plan.note ?? null, plan.recommendation === "approve" ? [] : ["responsibilities"], after(at0, 24));
          await decide(plan.decision, plan.reason ?? null, after(at0, 48), plan.recommendation);
          last = after(at0, 48);
        }

        for (const [i, c] of (spec.comments ?? []).entries()) {
          const author = c.from === "officer" ? officer : c.from === "manager" ? manager : holder;
          const at = after(at0, 3 + i);
          await tx.comment.create({ data: { requestId: request.id, authorId: author.id, body: c.body, isInternal: Boolean(c.internal), createdAt: at, isDemo: true } });
          await log(author.id, c.internal ? "request.internal_note_added" : "request.comment_added", at);
        }

        await tx.request.update({ where: { id: request.id }, data: { lastActivityAt: last } });

        // What each person has already seen: only what is genuinely new carries «جديد».
        const settled = plan.state === "DECIDED" || plan.state === "TWO_ROUNDS" || plan.state === "RETURNED_DIRECT" || plan.state === "REJECTED_DIRECT";
        const fresh = ageDays <= 3;
        const seen = new Set<string>();
        if (settled || plan.state === "OPENED" || plan.state === "WITH_MANAGER") seen.add(holder.id);
        if (!(plan.state === "WITH_MANAGER" || plan.state === "UNASSIGNED")) seen.add(manager.id);
        if (!(settled && fresh)) seen.add(officer.id);
        for (const userId of seen) await tx.requestSeen.create({ data: { userId, requestId: request.id, seenAt: after(last, 1) } });

        created.push(`${referenceNo} — ${plan.state} — ${spec.title}`);
      }

      await tx.auditLog.create({ data: { actorId: null, action: "demo.showcase_reset", entityType: "System", after: { ...removed, created: SPECS.length } } });

      // Self-check: every approval seal opens and matches its request, as on the public page. A manager's edit
      // comes before the approval, so the approval seal covers the edited evaluation.
      const approvals = await tx.requestSeal.findMany({ where: { kind: "APPROVAL" } });
      for (const row of approvals) {
        const statement = openSeal(row);
        if (!statement) throw new Error(`Seal ${row.serial} does not open.`);
        const content = await contentDigest(tx, row.requestId, statement.v);
        const latest = await tx.requestEvaluation.findFirstOrThrow({ where: { requestId: row.requestId }, orderBy: { createdAt: "desc" }, select: { criteria: true, note: true } });
        if (content !== statement.content || evaluationDigest(latest) !== statement.evaluation) throw new Error(`Seal ${row.serial} does not match its request.`);
      }
      return { removed, counts, created, sealsChecked: approvals.length, verifyCodes: approvals.slice(0, 3).map((a) => a.verifyCode) };
    },
    { timeout: 300_000, maxWait: 20_000 },
  );

  console.log(JSON.stringify({ removed: summary.removed, states: summary.counts, sealsChecked: summary.sealsChecked, sampleVerifyCodes: summary.verifyCodes }));
  for (const line of summary.created) console.log(line);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
