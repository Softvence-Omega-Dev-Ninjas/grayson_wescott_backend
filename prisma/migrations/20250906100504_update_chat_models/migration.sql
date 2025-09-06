/*
  Warnings:

  - You are about to drop the column `isRead` on the `private_messages` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'BLOCKED');

-- AlterTable
ALTER TABLE "public"."private_conversations" ADD COLUMN     "status" "public"."ConversationStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."private_messages" DROP COLUMN "isRead",
ADD COLUMN     "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
ALTER COLUMN "content" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "private_messages_conversationId_createdAt_idx" ON "public"."private_messages"("conversationId", "createdAt");
