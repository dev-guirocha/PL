-- Remove duplicate supervisor commissions per (supervisorId, betId).
-- Keeps the most "authoritative" row: paid > reserved > pending > canceled,
-- then prefers rows tied to a payout request, then oldest.

WITH ranked AS (
  SELECT
    id,
    "supervisorId",
    "betId",
    "payoutRequestId",
    "status",
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY "supervisorId", "betId"
      ORDER BY
        CASE "status"
          WHEN 'paid' THEN 0
          WHEN 'reserved' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        CASE WHEN "payoutRequestId" IS NULL THEN 1 ELSE 0 END,
        "createdAt" ASC,
        id ASC
    ) AS rn
  FROM "SupervisorCommission"
  WHERE "betId" IS NOT NULL
)
DELETE FROM "SupervisorCommission"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
