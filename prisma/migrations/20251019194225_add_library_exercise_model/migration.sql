-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('LEGS', 'CHEST', 'CORE', 'BACK', 'ARMS', 'SHOULDERS', 'ABS', 'FULLBODY', 'GRIP', 'GLUTES', 'CALVES');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('DUMBBELL', 'BARBELL', 'KETTLEBELL', 'BODYWEIGHT', 'RESISTANCEBAND', 'CABLE', 'DIPSTATION', 'SQUATRACK');

-- CreateTable
CREATE TABLE "library_exercises" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" INTEGER,
    "description" TEXT,
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'BEGINNER',
    "bodyPartTags" "BodyPart"[],
    "equipmentTags" "Equipment"[],
    "steps" TEXT[],
    "keyBenefits" TEXT[],
    "commonMistakes" TEXT[],
    "equipment" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "primaryMuscle" TEXT NOT NULL,
    "secondaryMuscle" TEXT NOT NULL,
    "caloriesBurned" TEXT NOT NULL,
    "isDeletedFromHyperhuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_exercises_pkey" PRIMARY KEY ("id")
);
