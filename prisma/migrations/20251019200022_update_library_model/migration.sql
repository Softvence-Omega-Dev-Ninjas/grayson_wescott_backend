-- AlterTable
ALTER TABLE "library_exercises" ADD COLUMN     "hyperhumanData" JSONB,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previewUrlExpiresAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailUrlExpiresAt" TIMESTAMP(3),
ADD COLUMN     "videoUrlExpiresAt" TIMESTAMP(3),
ALTER COLUMN "videoUrl" DROP NOT NULL;
