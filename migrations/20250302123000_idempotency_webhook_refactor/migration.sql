-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN "route" TEXT NOT NULL DEFAULT 'POST /api/bets';
ALTER TABLE "IdempotencyKey" ADD COLUMN "requestHash" TEXT;
DELETE FROM "IdempotencyKey" WHERE "userId" IS NULL;
ALTER TABLE "IdempotencyKey" ALTER COLUMN "userId" SET NOT NULL;

-- Drop old unique index on key
DROP INDEX IF EXISTS "IdempotencyKey_key_key";

-- Add new unique constraint and indexes
CREATE UNIQUE INDEX "IdempotencyKey_userId_route_key_key" ON "IdempotencyKey"("userId", "route", "key");
CREATE INDEX "IdempotencyKey_route_idx" ON "IdempotencyKey"("route");

-- Add relations
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'openpix';
ALTER TABLE "WebhookEvent" ADD COLUMN "pixChargeId" INTEGER;

-- Drop old unique index on eventId
DROP INDEX IF EXISTS "WebhookEvent_eventId_key";

-- Add new unique constraint and indexes
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");
CREATE INDEX "WebhookEvent_pixChargeId_idx" ON "WebhookEvent"("pixChargeId");

-- Add relation
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_pixChargeId_fkey" FOREIGN KEY ("pixChargeId") REFERENCES "PixCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
