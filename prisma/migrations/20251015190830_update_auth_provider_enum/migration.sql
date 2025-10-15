-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuthProvider" ADD VALUE 'INSTAGRAM';
ALTER TYPE "AuthProvider" ADD VALUE 'LINKEDIN';
ALTER TYPE "AuthProvider" ADD VALUE 'GITHUB';
ALTER TYPE "AuthProvider" ADD VALUE 'APPLE';
ALTER TYPE "AuthProvider" ADD VALUE 'TIKTOK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SignUpMethod" ADD VALUE 'INSTAGRAM';
ALTER TYPE "SignUpMethod" ADD VALUE 'LINKEDIN';
ALTER TYPE "SignUpMethod" ADD VALUE 'GITHUB';
ALTER TYPE "SignUpMethod" ADD VALUE 'APPLE';
ALTER TYPE "SignUpMethod" ADD VALUE 'TIKTOK';
