-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "usageLimit" INTEGER,
ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "type" SET DEFAULT 'fixed';

-- AlterTable
ALTER TABLE "PixCharge" ADD COLUMN     "bonusAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponId" INTEGER;

-- AddForeignKey
ALTER TABLE "PixCharge" ADD CONSTRAINT "PixCharge_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
