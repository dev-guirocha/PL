/*
  Warnings:

  - You are about to drop the column `resetCodeExpires` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "resetCodeExpires",
ADD COLUMN     "resetExpires" TIMESTAMP(3);
