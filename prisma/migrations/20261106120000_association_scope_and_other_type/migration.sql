-- D-151: the association chooses the track, then the programme and one or more of its initiatives; a request
-- type may ask the association to write what it requests («أخرى»).

-- AlterTable
ALTER TABLE "request_types" ADD COLUMN "requiresDetail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "requests" ADD COLUMN "requestTypeDetail" TEXT;

-- «أخرى»: offered last, and asks the association to write the type it wants.
INSERT INTO "request_types" ("id", "name", "description", "sortOrder", "requiresDetail", "updatedAt")
VALUES ('reqtype00000000000099', 'أخرى', 'إن لم تجدوا نوع طلبكم في القائمة، فاكتبوه بأنفسكم.',
        (SELECT COALESCE(MAX("sortOrder"), 0) + 1 FROM "request_types"), true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "requiresDetail" = true;

-- The two tracks of the Presidency's classification («التصنيف المقترح لرئاسة الحرمين», level B) that the first
-- five left out. A number already used is left as the super admin edited it.
INSERT INTO "tracks" ("id", "number", "name", "description", "sortOrder", "updatedAt")
SELECT v.id, v.number, v.name, v.description, v.number, CURRENT_TIMESTAMP
FROM (VALUES
  ('track000000000000000006', 6, 'الترجمة بالحرمين الشريفين',
   'المنظمات التي تعنى بأنشطة الترجمة من اللغة العربية إلى غيرها، ومن مختلف اللغات إلى العربية بالحرمين الشريفين.'),
  ('track000000000000000007', 7, 'المكتبات بالحرمين الشريفين',
   'المنظمات التي تعنى بالأنشطة المتعلقة بالمكتبات وإنشائها وتطويرها وتأهيلها والعناية بخدماتها ومقتنياتها وتجهيزاتها بالحرمين الشريفين.')
) AS v(id, number, name, description)
WHERE NOT EXISTS (SELECT 1 FROM "tracks" t WHERE t."number" = v.number);

-- For now every track covers every programme (owner's request); the super admin narrows them in «المسارات».
INSERT INTO "track_programs" ("trackId", "programId")
SELECT t."id", p."id" FROM "tracks" t CROSS JOIN "programs" p
ON CONFLICT DO NOTHING;
