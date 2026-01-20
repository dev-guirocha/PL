-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN     "pixKey" TEXT,
ADD COLUMN     "pixType" TEXT DEFAULT 'cpf';
