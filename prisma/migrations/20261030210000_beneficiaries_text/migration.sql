-- D-123: «المستفيدون المتوقعون» is free text (who and roughly how many), not a number.
ALTER TABLE "requests" ALTER COLUMN "expectedBeneficiaries" SET DATA TYPE TEXT USING "expectedBeneficiaries"::TEXT;
