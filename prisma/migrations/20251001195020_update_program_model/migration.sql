/*
  Warnings:

  - You are about to drop the column `endDate` on the `user_programs` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `user_programs` table. All the data in the column will be lost.
  - Added the required column `coachNote` to the `programs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."programs" ADD COLUMN     "coachNote" TEXT NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."user_programs" DROP COLUMN "endDate",
DROP COLUMN "startDate";
