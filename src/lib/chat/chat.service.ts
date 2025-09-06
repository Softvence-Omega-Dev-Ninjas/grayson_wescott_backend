import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

import { FileService } from '@project/lib/file/file.service';
import { SendPrivateMessageDto } from './dto/chat-gateway.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Load all chats (private + team) with last message for chat list
   */
  @HandleError('Failed to get all chats with last message')
  async getAllChatsWithLastMessage(userId: string): Promise<TResponse<any>> {
    // 1️⃣ Private chats
    const privateChats = await this.prisma.privateConversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        lastMessage: {
          include: {
            sender: true,
            file: true,
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
      return {
        type: 'private',
        chatId: chat.id,
        participant: otherUser,
        lastMessage: chat.lastMessage
          ? {
              id: chat.lastMessage.id,
              content: chat.lastMessage.content,
              createdAt: chat.lastMessage.createdAt,
              sender: chat.lastMessage.sender,
              file: chat.lastMessage.file,
            }
          : null,
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

    const conversation = this.prisma.privateConversation.findUnique({
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

    const conversation = this.prisma.privateConversation.create({
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
    let conversation = await this.findConversation(userA, userB);

    if (!conversation) {
      conversation = await this.createConversation(userA, userB);
    }
    return conversation;
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

    const message = await this.prisma.privateMessage.create({
      data: {
        content: dto.content,
        conversationId,
        senderId,
        fileId: fileRecord?.id,
        isRead: false,
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

    // Fetch conversation to set delivery status
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError(404, `Conversation ${conversationId} not found`);
    }

    await this.prisma.privateMessageStatus.createMany({
      data: [
        {
          messageId: message.id,
          userId: conversation.user1Id,
          status: 'DELIVERED',
        },
        {
          messageId: message.id,
          userId: conversation.user2Id,
          status: 'DELIVERED',
        },
      ],
      skipDuplicates: true,
    });

    return successResponse(message, 'Message sent successfully');
  }

  /**
   * Get all conversations for a user
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
      return {
        type: 'private',
        chatId: chat.id,
        participant: otherUser,
        lastMessage: chat.lastMessage || null,
        updatedAt: chat.updatedAt,
        isRead: chat.lastMessage?.isRead || false,
      };
    });

    return successResponse(chats, 'Conversations fetched successfully');
  }

  /**
   * Get all messages for a conversation
   */
  @HandleError("Conversation doesn't exist", 'PRIVATE_CHAT')
  async getConversationMessages(
    conversationId: string,
  ): Promise<TResponse<any>> {
    const messages = await this.prisma.privateMessage.findMany({
      where: { conversationId },
      include: {
        sender: true,
        file: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(messages, 'Messages fetched successfully');
  }

  /**
   * Get a conversation with messages (validate access)
   */
  @HandleError("Conversation doesn't exist", 'PRIVATE_CHAT')
  async getPrivateConversationWithMessages(
    conversationId: string,
    userId: string,
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
        messages: {
          orderBy: { createdAt: 'asc' },
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
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError(404, `Conversation not found or access denied`);
    }

    const data = {
      conversationId: conversation.id,
      participants: [conversation.user1, conversation.user2],
      messages: conversation.messages,
    };

    return successResponse(data, 'Conversation fetched successfully');
  }

  /**
   * Mark a message as read
   */
  @HandleError('Failed to mark message as read', 'PRIVATE_CHAT')
  async makePrivateMassageReadTrue(id: string): Promise<TResponse<any>> {
    const message = this.prisma.privateMessage.updateMany({
      where: { id },
      data: { isRead: true },
    });

    return successResponse(message, 'Message marked as read');
  }

  /**
   * Delete a conversation
   */
  @HandleError('Failed to delete conversation', 'PRIVATE_CHAT')
  async deleteConversation(conversationId: string): Promise<TResponse<any>> {
    const conversation = this.prisma.privateConversation.deleteMany({
      where: { id: conversationId },
    });

    return successResponse(conversation, 'Conversation deleted successfully');
  }
}
