-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "titleCustom" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows predate this column, and nothing on them records whether their
-- title was written by `deriveTitle` or typed by a clinician. Assume the
-- clinician. The two mistakes are not symmetric: a session that keeps a
-- heuristic title the model could have improved on is a cosmetic loss the
-- clinician can undo in the edit dialog, and a session that loses the name a
-- clinician gave it is gone the moment an admin re-runs the prompt.
--
-- Only rows that exist at this point are affected. Sessions created afterwards
-- take the column default and stay eligible for a model-written title.
UPDATE "sessions" SET "titleCustom" = true;
