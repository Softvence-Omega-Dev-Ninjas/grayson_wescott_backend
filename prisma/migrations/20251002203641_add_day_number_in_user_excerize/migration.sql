/*
  Warnings:

  - Added the required column `dayNumber` to the `user_program_exercises` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."user_program_exercises" ADD COLUMN     "dayNumber" INTEGER NOT NULL;
