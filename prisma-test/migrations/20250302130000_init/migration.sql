-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "resetCode" TEXT,
    "resetExpires" DATETIME,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "supervisorId" INTEGER,
    "pendingSupCode" TEXT,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "bonus" DECIMAL NOT NULL DEFAULT 0,
    "cpf" TEXT,
    "birthDate" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PixCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "txid" TEXT,
    "locId" TEXT,
    "copyAndPaste" TEXT,
    "qrCodeImage" TEXT,
    "expiresAt" DATETIME,
    "paidAt" DATETIME,
    "credited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bonusAmount" DECIMAL NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "couponId" INTEGER,
    "correlationId" TEXT NOT NULL,
    CONSTRAINT "PixCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PixCharge_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "loteria" TEXT,
    "codigoHorario" TEXT,
    "total" DECIMAL NOT NULL,
    "dataJogo" TEXT,
    "modalidade" TEXT,
    "colocacao" TEXT,
    "palpites" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "prize" DECIMAL NOT NULL DEFAULT 0,
    "settledAt" DATETIME,
    "recheckedAt" DATETIME,
    "resultId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bet_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT,
    "userId" INTEGER NOT NULL,
    "betId" INTEGER,
    "response" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdempotencyKey_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "correlationId" TEXT,
    "pixChargeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pixChargeId_fkey" FOREIGN KEY ("pixChargeId") REFERENCES "PixCharge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Result" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loteria" TEXT NOT NULL,
    "codigoHorario" TEXT,
    "dataJogo" TEXT,
    "numeros" TEXT NOT NULL,
    "grupos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ResultPule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "resultId" INTEGER,
    "loteria" TEXT NOT NULL,
    "codigoHorario" TEXT,
    "dataJogo" TEXT,
    "numeros" TEXT NOT NULL,
    "grupos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultPule_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pixKey" TEXT,
    "pixType" TEXT DEFAULT 'cpf',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'fixed',
    "amount" DECIMAL NOT NULL,
    "minDeposit" DECIMAL NOT NULL DEFAULT 0,
    "maxDeposit" DECIMAL,
    "maxUses" INTEGER NOT NULL DEFAULT 1000,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUser" INTEGER NOT NULL DEFAULT 1,
    "firstDepositOnly" BOOLEAN NOT NULL DEFAULT false,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "couponId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "depositId" TEXT NOT NULL,
    "amountApplied" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisorCommission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supervisorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "betId" INTEGER,
    "amount" DECIMAL NOT NULL,
    "basis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupervisorCommission_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorCommission_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "playing_with_neon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" REAL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "PixCharge_txid_key" ON "PixCharge"("txid");

-- CreateIndex
CREATE UNIQUE INDEX "PixCharge_correlationId_key" ON "PixCharge"("correlationId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Bet_loteria_dataJogo_codigoHorario_idx" ON "Bet"("loteria", "dataJogo", "codigoHorario");

-- CreateIndex
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_status_idx" ON "Bet"("status");

-- CreateIndex
CREATE INDEX "Bet_resultId_idx" ON "Bet"("resultId");

-- CreateIndex
CREATE INDEX "Bet_createdAt_idx" ON "Bet"("createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_idx" ON "IdempotencyKey"("userId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_route_idx" ON "IdempotencyKey"("route");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_userId_route_key_key" ON "IdempotencyKey"("userId", "route", "key");

-- CreateIndex
CREATE INDEX "WebhookEvent_correlationId_idx" ON "WebhookEvent"("correlationId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "WebhookEvent_pixChargeId_idx" ON "WebhookEvent"("pixChargeId");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_code_key" ON "Supervisor"("code");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_depositId_key" ON "CouponRedemption"("depositId");

