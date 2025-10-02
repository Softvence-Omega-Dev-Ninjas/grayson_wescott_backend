-- CreateEnum
CREATE TYPE "public"."ExerciseStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'RETRY');

-- CreateTable
CREATE TABLE "public"."user_program_exercises" (
    "id" TEXT NOT NULL,
    "userProgramId" TEXT NOT NULL,
    "programExerciseId" TEXT,
    "status" "public"."ExerciseStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "equipmentUsed" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_program_exercises_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."user_program_exercises" ADD CONSTRAINT "user_program_exercises_userProgramId_fkey" FOREIGN KEY ("userProgramId") REFERENCES "public"."user_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_program_exercises" ADD CONSTRAINT "user_program_exercises_programExerciseId_fkey" FOREIGN KEY ("programExerciseId") REFERENCES "public"."program_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
