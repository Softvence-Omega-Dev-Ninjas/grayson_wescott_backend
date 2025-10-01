/*
  Warnings:

  - The values [ACTIVE] on the enum `ProgramProgress` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `restSeconds` on the `program_exercises` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProgramProgress_new" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED');
ALTER TABLE "public"."user_programs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."user_programs" ALTER COLUMN "status" TYPE "public"."ProgramProgress_new" USING ("status"::text::"public"."ProgramProgress_new");
ALTER TYPE "public"."ProgramProgress" RENAME TO "ProgramProgress_old";
ALTER TYPE "public"."ProgramProgress_new" RENAME TO "ProgramProgress";
DROP TYPE "public"."ProgramProgress_old";
ALTER TABLE "public"."user_programs" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
COMMIT;

-- AlterEnum
ALTER TYPE "public"."ProgramStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "public"."program_exercises" DROP COLUMN "restSeconds",
ADD COLUMN     "rest" INTEGER;

-- AlterTable
ALTER TABLE "public"."user_programs" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
