-- AlterEnum
ALTER TYPE "public"."OtpType" ADD VALUE 'PHONE_VERIFICATION';

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false;
