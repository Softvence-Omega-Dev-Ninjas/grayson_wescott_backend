-- CreateEnum
CREATE TYPE "public"."FileType" AS ENUM ('IMAGE', 'DOCS', 'LINK', 'DOCUMENT', 'ANY', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('Shift', 'TimeOff', 'Announcement', 'Task', 'Recognition', 'UrgentShiftChanged');

-- CreateEnum
CREATE TYPE "public"."MessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('GOOGLE', 'FACEBOOK', 'TWITTER');

-- CreateEnum
CREATE TYPE "public"."SignUpMethod" AS ENUM ('EMAIL', 'MANUAL', 'GOOGLE', 'FACEBOOK', 'TWITTER');

-- CreateEnum
CREATE TYPE "public"."TwoFAMethod" AS ENUM ('EMAIL', 'PHONE', 'AUTH_APP');

-- CreateTable
CREATE TABLE "public"."file_instances" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" "public"."FileType" NOT NULL DEFAULT 'ANY',
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."private_conversations" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."private_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "fileId" TEXT,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."private_message_statuses" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."MessageDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_message_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "username" TEXT,
    "password" TEXT,
    "name" TEXT DEFAULT 'Unnamed User',
    "avatarUrl" TEXT DEFAULT 'https://www.gravatar.com/avatar/000000000000000000000000000000?d=mp&f=y',
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "signUpMethod" "public"."SignUpMethod" NOT NULL DEFAULT 'EMAIL',
    "otp" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isTwoFAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFAMethod" "public"."TwoFAMethod",
    "twoFASecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_auth_providers" (
    "id" TEXT NOT NULL,
    "provider" "public"."AuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_userId_notificationId_key" ON "public"."user_notifications"("userId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "private_conversations_user1Id_user2Id_key" ON "public"."private_conversations"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "private_messages_conversationId_createdAt_idx" ON "public"."private_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "private_message_statuses_messageId_userId_key" ON "public"."private_message_statuses"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_providers_provider_providerId_key" ON "public"."user_auth_providers"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "public"."user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_notifications" ADD CONSTRAINT "user_notifications_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_conversations" ADD CONSTRAINT "private_conversations_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_conversations" ADD CONSTRAINT "private_conversations_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_conversations" ADD CONSTRAINT "private_conversations_lastMessageId_fkey" FOREIGN KEY ("lastMessageId") REFERENCES "public"."private_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_messages" ADD CONSTRAINT "private_messages_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_messages" ADD CONSTRAINT "private_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."private_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_messages" ADD CONSTRAINT "private_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_message_statuses" ADD CONSTRAINT "private_message_statuses_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."private_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_message_statuses" ADD CONSTRAINT "private_message_statuses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_auth_providers" ADD CONSTRAINT "user_auth_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
