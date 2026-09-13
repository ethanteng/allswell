-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill each client's sessions in the order they were displayed before this
-- column existed (session date first, then creation time, newest first), so the
-- sidebar looks identical the moment this ships. Without it every row sits at 0
-- and the order becomes whatever the secondary sort happens to produce.
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "clientId"
      ORDER BY "sessionDate" DESC NULLS FIRST, "createdAt" DESC
    ) - 1 AS rn
  FROM "sessions"
)
UPDATE "sessions" AS s
SET "position" = ordered.rn
FROM ordered
WHERE s.id = ordered.id;
