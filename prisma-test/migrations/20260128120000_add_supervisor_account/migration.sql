-- Add supervisor account linkage (userId) + optional commissionRate
ALTER TABLE "Supervisor" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Supervisor" ADD COLUMN "commissionRate" DECIMAL;

CREATE UNIQUE INDEX "Supervisor_userId_key" ON "Supervisor"("userId");
