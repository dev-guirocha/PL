-- Targeted migration for supervisor concurrency and commission schema.
-- Safe to run on existing databases (uses IF NOT EXISTS and guards).

-- Supervisor: add commissionRate and userId columns
ALTER TABLE "Supervisor"
  ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "userId" INTEGER;

-- Unique index for supervisor user binding
CREATE UNIQUE INDEX IF NOT EXISTS "Supervisor_userId_key"
  ON "Supervisor" ("userId")
  WHERE "userId" IS NOT NULL;

-- FK Supervisor.userId -> User.id (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Supervisor_userId_fkey'
  ) THEN
    ALTER TABLE "Supervisor"
      ADD CONSTRAINT "Supervisor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- SupervisorCommission: add columns
ALTER TABLE "SupervisorCommission"
  ADD COLUMN IF NOT EXISTS "payoutRequestId" INTEGER,
  ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,2);

-- Unique per supervisor/bet
CREATE UNIQUE INDEX IF NOT EXISTS "SupervisorCommission_supervisorId_betId_key"
  ON "SupervisorCommission" ("supervisorId", "betId");

-- Performance indexes
CREATE INDEX IF NOT EXISTS "SupervisorCommission_supervisorId_status_idx"
  ON "SupervisorCommission" ("supervisorId", "status");

CREATE INDEX IF NOT EXISTS "SupervisorCommission_supervisorId_createdAt_idx"
  ON "SupervisorCommission" ("supervisorId", "createdAt");

CREATE INDEX IF NOT EXISTS "SupervisorCommission_payoutRequestId_idx"
  ON "SupervisorCommission" ("payoutRequestId");

-- SupervisorWithdrawalRequest table
CREATE TABLE IF NOT EXISTS "SupervisorWithdrawalRequest" (
  "id" SERIAL NOT NULL,
  "supervisorId" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "pixKey" TEXT,
  "pixType" TEXT DEFAULT 'cpf',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupervisorWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupervisorWithdrawalRequest_supervisorId_status_idx"
  ON "SupervisorWithdrawalRequest" ("supervisorId", "status");

-- FK SupervisorWithdrawalRequest.supervisorId -> Supervisor.id (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupervisorWithdrawalRequest_supervisorId_fkey'
  ) THEN
    ALTER TABLE "SupervisorWithdrawalRequest"
      ADD CONSTRAINT "SupervisorWithdrawalRequest_supervisorId_fkey"
      FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- FK SupervisorCommission.payoutRequestId -> SupervisorWithdrawalRequest.id (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupervisorCommission_payoutRequestId_fkey'
  ) THEN
    ALTER TABLE "SupervisorCommission"
      ADD CONSTRAINT "SupervisorCommission_payoutRequestId_fkey"
      FOREIGN KEY ("payoutRequestId") REFERENCES "SupervisorWithdrawalRequest"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
