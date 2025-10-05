-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "allowDirectMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowEmailMessages" BOOLEAN NOT NULL DEFAULT true;
