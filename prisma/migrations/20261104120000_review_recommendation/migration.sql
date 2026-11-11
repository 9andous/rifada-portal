-- The supervisor's evaluation carries a recommendation; the unit manager takes the final decision (D-139).
-- Evaluations made before this could only lead to an approval, so existing rows recommend APPROVE.
CREATE TYPE "ReviewRecommendation" AS ENUM ('APPROVE', 'RETURN', 'REJECT');

ALTER TABLE "request_evaluations"
  ADD COLUMN "recommendation" "ReviewRecommendation" NOT NULL DEFAULT 'APPROVE',
  ADD COLUMN "reason" TEXT;
