import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

import { FileService } from '@project/lib/file/file.service';
import { SendPrivateMessageDto } from '../dto/chat-gateway.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Load all chats (private) with last message for chat list
   */
  @HandleError('Failed to get all chats with last message')
  async getAllChatsWithLastMessage(userId: string): Promise<TResponse<any>> {
    // Query conversations and include lastMessage + its statuses
    const privateChats = await this.prisma.privateConversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        lastMessage: {
          include: {
            sender: true,
            file: true,
            statuses: true,
          },
        },
        user1: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
        user2: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedPrivateChats = privateChats.map((chat: any) => {
      const otherUser = chat.user1Id === userId ? chat.user2 : chat.user1;

      // Determine lastMessage status for current user
      let lastMessageForUser = null;
      if (chat.lastMessage) {
        const statusForUser = (chat.lastMessage.statuses || []).find(
          (s: any) => s.userId === userId,
        );
        lastMessageForUser = {
          id: chat.lastMessage.id,
          content: chat.lastMessage.content,
          createdAt: chat.lastMessage.createdAt,
          sender: chat.lastMessage.sender,
          file: chat.lastMessage.file,
          // status for this user (SENT | DELIVERED | READ) or null if missing
          status: statusForUser ? statusForUser.status : null,
        };
      }

      return {
        type: 'private',
        chatId: chat.id,
        participant: otherUser,
        lastMessage: lastMessageForUser,
        updatedAt: chat.updatedAt,
      };
    });

    return successResponse(formattedPrivateChats, 'Chats fetched successfully');
  }

  /**
   * Find existing conversation between two users or create one
   */
  @HandleError('Failed to find conversation', 'PRIVATE_CHAT')
  async findConversation(
    userA: string,
    userB: string,
  ): Promise<TResponse<any>> {
    const [user1Id, user2Id] = [userA, userB].sort();

    const conversation = await this.prisma.privateConversation.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id,
          user2Id,
        },
      },
    });

    return successResponse(conversation, 'Conversation fetched successfully');
  }

  /**
   * Create new conversation between two users
   */
  @HandleError('Failed to create conversation', 'PRIVATE_CHAT')
  async createConversation(
    userA: string,
    userB: string,
  ): Promise<TResponse<any>> {
    const [user1Id, user2Id] = [userA, userB].sort();

    const conversation = await this.prisma.privateConversation.create({
      data: { user1Id, user2Id },
    });

    return successResponse(conversation, 'Conversation created successfully');
  }

  /**
   * Find existing conversation between two users or create one
   */
  @HandleError('Failed to find or create conversation', 'PRIVATE_CHAT')
  async findOrCreateConversation(
    userA: string,
    userB: string,
  ): Promise<TResponse<any>> {
    const found = await this.findConversation(userA, userB);
    if (found && found.data) {
      return found;
    }
    return this.createConversation(userA, userB);
  }

  /**
   * Send a private message and update lastMessage in conversation
   */
  @HandleError('Failed to send private message', 'PRIVATE_CHAT')
  async sendPrivateMessage(
    conversationId: string,
    senderId: string,
    dto: SendPrivateMessageDto,
    file?: Express.Multer.File,
  ): Promise<TResponse<any>> {
    let fileRecord;
    if (file) {
      fileRecord = await this.fileService.processUploadedFile(file);
    }

    // Determine MessageType
    const getMessageType = (file?: Express.Multer.File) => {
      if (!file) return 'TEXT';
      const mimetype = file.mimetype || '';
      if (mimetype.startsWith('image')) return 'IMAGE';
      if (mimetype.startsWith('video')) return 'VIDEO';
      if (mimetype.startsWith('audio')) return 'AUDIO';

      return 'FILE';
    };

    const messageType = getMessageType(file);

    // Create message
    const message = await this.prisma.privateMessage.create({
      data: {
        content: dto.content ?? null,
        conversationId,
        senderId,
        fileId: fileRecord?.id ?? null,
        type: messageType,
      },
      include: {
        sender: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
        file: true,
        statuses: true,
      },
    });

    // Update last message reference in conversation
    await this.prisma.privateConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(),
      },
    });

    // Fetch conversation to set delivery status and determine recipient
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError(404, `Conversation ${conversationId} not found`);
    }

    const recipientId =
      conversation.user1Id === senderId
        ? conversation.user2Id
        : conversation.user1Id;

    // Create per-user statuses:
    // - For sender => READ
    // - For recipient => DELIVERED
    await this.prisma.privateMessageStatus.createMany({
      data: [
        {
          messageId: message.id,
          userId: senderId,
          status: 'READ',
        },
        {
          messageId: message.id,
          userId: recipientId,
          status: 'DELIVERED',
        },
      ],
      skipDuplicates: true,
    });

    // reload message with statuses for returning
    const messageWithStatuses = await this.prisma.privateMessage.findUnique({
      where: { id: message.id },
      include: {
        sender: {
          select: { id: true, profileUrl: true, name: true, email: true },
        },
        file: true,
        statuses: true,
      },
    });

    return successResponse(messageWithStatuses, 'Message sent successfully');
  }

  /**
   * Get all conversations for a user (more compact)
   */
  @HandleError("Error getting user's conversations", 'PRIVATE_CHAT')
  async getUserConversations(userId: string): Promise<TResponse<any>> {
    const conversations = await this.prisma.privateConversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        lastMessage: {
          include: {
            sender: {
              select: {
                id: true,
                profileUrl: true,
                name: true,
                email: true,
              },
            },
            file: true,
            statuses: true,
          },
        },
        user1: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
        user2: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const chats = conversations.map((chat: any) => {
      const otherUser = chat.user1Id === userId ? chat.user2 : chat.user1;
      const lastMessage = chat.lastMessage || null;

      // Determine status of last message for this user (if any)
      const lastMessageStatus = lastMessage
        ? (lastMessage.statuses || []).find((s: any) => s.userId === userId)
        : null;

      return {
        type: 'private',
        chatId: chat.id,
        participant: otherUser,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              sender: lastMessage.sender,
              file: lastMessage.file,
              status: lastMessageStatus ? lastMessageStatus.status : null,
            }
          : null,
        updatedAt: chat.updatedAt,
      };
    });

    return successResponse(chats, 'Conversations fetched successfully');
  }

  /**
   * Get messages for a conversation with cursor-based pagination.
   *
   * Behavior:
   * - initial load: call with beforeMessageId = undefined -> returns latest `limit` messages (chronological asc)
   * - load previous (scroll up): call with beforeMessageId = idOfEarliestMessageInCurrentView
   *
   * Returns messages in chronological order (oldest -> newest).
   */
  @HandleError("Conversation doesn't exist", 'PRIVATE_CHAT')
  async getConversationMessages(
    conversationId: string,
    limit = 20,
    beforeMessageId?: string,
  ): Promise<TResponse<any>> {
    // Ensure conversation exists
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError(404, `Conversation ${conversationId} not found`);
    }

    // If no cursor: get latest `limit` messages in descending order then reverse to return chronological
    if (!beforeMessageId) {
      const newest = await this.prisma.privateMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          sender: {
            select: { id: true, profileUrl: true, name: true, email: true },
          },
          file: true,
          statuses: true,
        },
      });

      const chronological = newest.reverse();
      return successResponse(chronological, 'Messages fetched successfully');
    }

    // If cursor provided -> fetch messages older than the cursor message
    // We use cursor with skip: 1 and orderBy createdAt desc, then reverse result to chronological
    const beforeMessage = await this.prisma.privateMessage.findUnique({
      where: { id: beforeMessageId },
      select: { id: true, createdAt: true, conversationId: true },
    });

    if (!beforeMessage || beforeMessage.conversationId !== conversationId) {
      throw new AppError(404, `Reference message not found in conversation`);
    }

    const older = await this.prisma.privateMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      cursor: { id: beforeMessageId },
      skip: 1, // skip the cursor itself
      take: limit,
      include: {
        sender: {
          select: { id: true, profileUrl: true, name: true, email: true },
        },
        file: true,
        statuses: true,
      },
    });

    const chronological = older.reverse();
    return successResponse(
      chronological,
      'Previous messages fetched successfully',
    );
  }

  /**
   * Get a conversation with initial messages (latest `limit` messages) and validate access
   */
  @HandleError("Conversation doesn't exist", 'PRIVATE_CHAT')
  async getPrivateConversationWithMessages(
    conversationId: string,
    userId: string,
    limit = 40,
  ): Promise<TResponse<any>> {
    const conversation = await this.prisma.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
        user2: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError(404, `Conversation not found or access denied`);
    }

    // Fetch latest `limit` messages
    const newest = await this.prisma.privateMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            profileUrl: true,
            name: true,
            email: true,
          },
        },
        file: true,
        statuses: true,
      },
    });

    const messages = newest.reverse(); // chronological order

    const data = {
      conversationId: conversation.id,
      participants: [conversation.user1, conversation.user2],
      messages,
    };

    return successResponse(data, 'Conversation fetched successfully');
  }

  /**
   * Mark a message as read for a specific user (update PrivateMessageStatus)
   */
  @HandleError('Failed to mark message as read', 'PRIVATE_CHAT')
  async makePrivateMessageReadTrue(
    messageId: string,
    userId: string,
  ): Promise<TResponse<any>> {
    // Set status to READ for this user/message pair
    const updated = await this.prisma.privateMessageStatus.updateMany({
      where: { messageId, userId },
      data: { status: 'READ', updatedAt: new Date() },
    });

    // Mark multiple messages as read in a conversation for that user, when
    // you can expand this logic to update many based on conversationId and createdAt <= some date.

    return successResponse(updated, 'Message status marked as READ');
  }

  /**
   * Delete a conversation
   */
  @HandleError('Failed to delete conversation', 'PRIVATE_CHAT')
  async deleteConversation(conversationId: string): Promise<TResponse<any>> {
    const conversation = await this.prisma.privateConversation.deleteMany({
      where: { id: conversationId },
    });

    return successResponse(conversation, 'Conversation deleted successfully');
  }
}
