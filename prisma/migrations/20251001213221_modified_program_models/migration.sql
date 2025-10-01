/*
  Warnings:

  - You are about to drop the column `endDate` on the `programs` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `programs` table. All the data in the column will be lost.
  - Added the required column `duration` to the `programs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."programs" DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "duration" INTEGER NOT NULL,
ALTER COLUMN "coachNote" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."user_programs" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
