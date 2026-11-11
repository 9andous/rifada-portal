-- The supervisor chooses the programme and initiatives, never the association (D-123, D-145). Requests from
-- before D-123 still carry what the association chose: clear it where no supervisor has reviewed the request
-- yet. Decided requests and those with the unit manager keep theirs, as their seals cover it (D-122).
DELETE FROM "request_initiatives"
WHERE "requestId" IN (
  SELECT r."id"
  FROM "requests" r
  JOIN "request_statuses" s ON s."id" = r."statusId"
  WHERE s."key" NOT IN ('APPROVED', 'REJECTED')
    AND r."reviewStage" = 'SUPERVISOR'
    AND NOT EXISTS (SELECT 1 FROM "request_scope_changes" c WHERE c."requestId" = r."id")
);

UPDATE "requests" r
SET "programId" = NULL, "initiativeId" = NULL
FROM "request_statuses" s
WHERE s."id" = r."statusId"
  AND s."key" NOT IN ('APPROVED', 'REJECTED')
  AND r."reviewStage" = 'SUPERVISOR'
  AND (r."programId" IS NOT NULL OR r."initiativeId" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "request_scope_changes" c WHERE c."requestId" = r."id");
