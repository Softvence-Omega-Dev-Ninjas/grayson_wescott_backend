/*
  Warnings:

  - A unique constraint covering the columns `[userId,programId]` on the table `user_programs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_programs_unique" ON "public"."user_programs"("userId", "programId");
