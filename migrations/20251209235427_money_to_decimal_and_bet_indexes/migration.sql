/*
  Warnings:

  - You are about to alter the column `total` on the `Bet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `prize` on the `Bet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `PixCharge` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `SupervisorCommission` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `balance` on the `User` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `bonus` on the `User` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `WithdrawalRequest` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.

*/
-- AlterTable
ALTER TABLE "Bet" ALTER COLUMN "total" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "prize" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Coupon" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PixCharge" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "SupervisorCommission" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "bonus" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- CreateIndex
CREATE INDEX "Bet_loteria_dataJogo_codigoHorario_idx" ON "Bet"("loteria", "dataJogo", "codigoHorario");

-- CreateIndex
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");
