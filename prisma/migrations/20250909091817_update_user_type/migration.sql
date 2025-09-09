-- CreateEnum
CREATE TYPE "public"."OtpType" AS ENUM ('VERIFICATION', 'TFA');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "otpType" "public"."OtpType";
