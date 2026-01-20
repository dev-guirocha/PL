-- ManualSettlement patch (idempotent)
CREATE TABLE IF NOT EXISTS "ManualSettlement" (
  "id" SERIAL PRIMARY KEY,
  "betId" INTEGER NOT NULL,
  "resultId" INTEGER NOT NULL,
  "adminUserId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "prize" NUMERIC(18,2) NOT NULL,
  "action" TEXT NOT NULL,
  "snapshotBet" JSONB,
  "snapshotResult" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ManualSettlement_betId_idx" ON "ManualSettlement" ("betId");
CREATE INDEX IF NOT EXISTS "ManualSettlement_resultId_idx" ON "ManualSettlement" ("resultId");
CREATE INDEX IF NOT EXISTS "ManualSettlement_adminUserId_idx" ON "ManualSettlement" ("adminUserId");
CREATE INDEX IF NOT EXISTS "ManualSettlement_createdAt_idx" ON "ManualSettlement" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManualSettlement_betId_fkey'
  ) THEN
    ALTER TABLE "ManualSettlement"
      ADD CONSTRAINT "ManualSettlement_betId_fkey"
      FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManualSettlement_resultId_fkey'
  ) THEN
    ALTER TABLE "ManualSettlement"
      ADD CONSTRAINT "ManualSettlement_resultId_fkey"
      FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManualSettlement_adminUserId_fkey'
  ) THEN
    ALTER TABLE "ManualSettlement"
      ADD CONSTRAINT "ManualSettlement_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Future-proof columns (safe additions)
ALTER TABLE "ManualSettlement" ADD COLUMN IF NOT EXISTS "snapshotBet" JSONB;
ALTER TABLE "ManualSettlement" ADD COLUMN IF NOT EXISTS "snapshotResult" JSONB;
ALTER TABLE "ManualSettlement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
