-- D-119/D-123: the five tracks, for databases where the seed never added them (the tracks
-- migration creates the table only). Supervisors and requests are moved to tracks by the next
-- migration, which needs the tracks to exist. Does nothing when any track exists.

INSERT INTO "tracks" ("id", "number", "name", "description", "sortOrder", "updatedAt")
SELECT v.id, v.number, v.name, v.description, v.number, CURRENT_TIMESTAMP FROM (VALUES
  ('trackseed000000000001', 1, 'الدعوة والإرشاد والتوعية الدينية والفكرية', 'المنظمات التي تعنى بالدعوة والإرشاد وتعليم القيم وإقامة الشعائر ونشر التوعية الدينية والفكرية بين قاصدي الحرمين الشريفين.'),
  ('trackseed000000000002', 2, 'العناية بالقرآن الكريم والمصاحف', 'المنظمات التي تعنى بتحفيظ وتعليم القرآن الكريم والعناية بالمصاحف وصونها بالحرمين الشريفين.'),
  ('trackseed000000000003', 3, 'العناية بالتطويف والمطوفين', 'المنظمات التي تعنى بالتطويف والمطوفين وشؤونهم وإرشاد الطائفين بالحرمين الشريفين.'),
  ('trackseed000000000004', 4, 'البحوث العلمية والمطبوعات والترجمة', 'المنظمات التي تعنى بإعداد البحوث وطباعة ونشر العلوم الشرعية وترجمتها، وبالمكتبات ومصادر المعرفة بالحرمين الشريفين.'),
  ('trackseed000000000005', 5, 'خدمة الحجاج والمعتمرين والزوار', 'المنظمات التي تعمل على خدمة ضيوف الرحمن وإثراء تجربتهم الدينية بالحرمين الشريفين.')
) AS v(id, number, name, description)
WHERE NOT EXISTS (SELECT 1 FROM "tracks");

INSERT INTO "track_programs" ("trackId", "programId")
SELECT l.track_id, p."id" FROM (VALUES
  ('trackseed000000000001', 1),
  ('trackseed000000000001', 2),
  ('trackseed000000000001', 4),
  ('trackseed000000000001', 6),
  ('trackseed000000000001', 7),
  ('trackseed000000000002', 1),
  ('trackseed000000000002', 5),
  ('trackseed000000000003', 6),
  ('trackseed000000000004', 3),
  ('trackseed000000000005', 6),
  ('trackseed000000000005', 7)
) AS l(track_id, program_number)
JOIN "programs" p ON p."number" = l.program_number
WHERE EXISTS (SELECT 1 FROM "tracks" WHERE "id" = l.track_id)
ON CONFLICT DO NOTHING;
