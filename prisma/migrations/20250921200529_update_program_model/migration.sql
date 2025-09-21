/*
  Warnings:

  - You are about to drop the `exercises` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."exercises" DROP CONSTRAINT "exercises_programId_fkey";

-- DropTable
DROP TABLE "public"."exercises";

-- CreateTable
CREATE TABLE "public"."program_exercises" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dayOfWeek" "public"."DayOfWeek" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "restSeconds" INTEGER,
    "reps" INTEGER,
    "sets" INTEGER,
    "tempo" TEXT,
    "videoUrl" TEXT,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_exercises_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."program_exercises" ADD CONSTRAINT "program_exercises_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
