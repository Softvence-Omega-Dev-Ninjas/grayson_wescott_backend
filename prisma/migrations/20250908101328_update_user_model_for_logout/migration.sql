-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "isLoggedIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLogoutAt" TIMESTAMP(3);
