/*
  Warnings:

  - You are about to drop the column `categories` on the `programs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."programs" DROP COLUMN "categories";

-- DropEnum
DROP TYPE "public"."ExerciseCategory";

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_categories" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "program_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "public"."categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "program_category_unique" ON "public"."program_categories"("programId", "categoryId");

-- AddForeignKey
ALTER TABLE "public"."program_categories" ADD CONSTRAINT "program_categories_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_categories" ADD CONSTRAINT "program_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
