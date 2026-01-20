-- CreateTable
CREATE TABLE "ManualSettlement" (
    "id" SERIAL NOT NULL,
    "betId" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "prize" DECIMAL(18,2) NOT NULL,
    "action" TEXT NOT NULL,
    "snapshotBet" JSONB,
    "snapshotResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualSettlement_betId_idx" ON "ManualSettlement"("betId");

-- CreateIndex
CREATE INDEX "ManualSettlement_resultId_idx" ON "ManualSettlement"("resultId");

-- CreateIndex
CREATE INDEX "ManualSettlement_adminUserId_idx" ON "ManualSettlement"("adminUserId");

-- CreateIndex
CREATE INDEX "ManualSettlement_createdAt_idx" ON "ManualSettlement"("createdAt");

-- AddForeignKey
ALTER TABLE "ManualSettlement" ADD CONSTRAINT "ManualSettlement_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSettlement" ADD CONSTRAINT "ManualSettlement_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSettlement" ADD CONSTRAINT "ManualSettlement_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
