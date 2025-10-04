/*
  Warnings:

  - You are about to drop the `PrivateCall` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PrivateCall" DROP CONSTRAINT "PrivateCall_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrivateCall" DROP CONSTRAINT "PrivateCall_initiatorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrivateCallParticipant" DROP CONSTRAINT "PrivateCallParticipant_callId_fkey";

-- AlterTable
ALTER TABLE "public"."PrivateCallParticipant" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."PrivateCall";

-- CreateTable
CREATE TABLE "public"."private_calls" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "initiatorId" TEXT,
    "type" "public"."CallType" NOT NULL,
    "status" "public"."CallStatus" NOT NULL DEFAULT 'INITIATED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_calls_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."private_calls" ADD CONSTRAINT "private_calls_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."private_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_calls" ADD CONSTRAINT "private_calls_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateCallParticipant" ADD CONSTRAINT "PrivateCallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "public"."private_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
