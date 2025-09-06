import { Injectable, NotFoundException } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { successResponse } from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

import { SendPrivateMessageDto } from './dto/privateChatGateway.dto';
import { FileService } from '@project/lib/file/file.service';

@Injectable()
export class PrivateChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Load all chats (private + team) with last message for chat list
   */
  @HandleError('Failed to get all chats with last message')
  async getAllChatsWithLastMessage(userId: string) {
    // 1️⃣ Private chats
    const privateChats = await this.prisma.privateConversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        lastMessage: {
          include: {
            sender: {
              select: {
                id: true,
                profile: {
                  select: {
                    profileUrl: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            file: true,
          },
        },
        user1: {
          select: {
            id: true,
            profile: {
              select: {
                profileUrl: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            profile: {
              select: {
                profileUrl: true,
                firstName: true,
                lastName: true,
              },
            },
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

    // 2️⃣ Team chats (optional)
    const teamChats = await this.prisma.team.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        lastMessage: {
          include: {
            sender: {
              select: {
                id: true,
                profile: {
                  select: {
                    profileUrl: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            file: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedTeamChats = teamChats.map((team: any) => ({
      type: 'team',
      chatId: team.id,
      title: team.title,
      lastMessage: team.lastMessage
        ? {
            id: team.lastMessage.id,
            content: team.lastMessage.content,
            createdAt: team.lastMessage.createdAt,
            sender: team.lastMessage.sender,
            file: team.lastMessage.file,
          }
        : null,
      updatedAt: team.updatedAt,
    }));

    // 3️⃣ Merge & sort
    const allChats = [...formattedPrivateChats, ...formattedTeamChats].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    return successResponse(allChats, 'Chats fetched successfully');
  }

  /**
   * Find existing conversation between two users or create one
   */
  @HandleError('Failed to find conversation', 'PRIVATE_CHAT')
  async findConversation(userA: string, userB: string) {
    const [user1Id, user2Id] = [userA, userB].sort();
    return this.prisma.privateConversation.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id,
          user2Id,
        },
      },
    });
  }

  /**
   * Create new conversation between two users
   */
  @HandleError('Failed to create conversation', 'PRIVATE_CHAT')
  async createConversation(userA: string, userB: string) {
    const [user1Id, user2Id] = [userA, userB].sort();
    return this.prisma.privateConversation.create({
      data: { user1Id, user2Id },
    });
  }

  /**
   * Find existing conversation between two users or create one
   */
  @HandleError('Failed to find or create conversation', 'PRIVATE_CHAT')
  async findOrCreateConversation(userA: string, userB: string) {
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
  ) {
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
            profile: {
              select: {
                profileUrl: true,
                firstName: true,
                lastName: true,
              },
            },
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
      throw new NotFoundException(`Conversation ${conversationId} not found`);
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

    return message;
  }

  /**
   * Get all conversations for a user
   */
  @HandleError("Error getting user's conversations", 'PRIVATE_CHAT')
  async getUserConversations(userId: string) {
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
                profile: {
                  select: {
                    profileUrl: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            file: true,
          },
        },
        user1: {
          select: {
            id: true,
            profile: {
              select: {
                profileUrl: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            profile: {
              select: {
                profileUrl: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((chat: any) => {
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
  }

  /**
   * Get all messages for a conversation
   */
  @HandleError("Conversation doesn't exist", 'PRIVATE_CHAT')
  async getConversationMessages(conversationId: string) {
    return this.prisma.privateMessage.findMany({
      where: { conversationId },
      include: {
        sender: true,
        file: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get a conversation with messages (validate access)
   */
  @HandleError("Conversation doesn't exist", 'PRIVATE_CHAT')
  async getPrivateConversationWithMessages(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.prisma.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profileUrl: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profileUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profileUrl: true,
                  },
                },
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

    return {
      conversationId: conversation.id,
      participants: [conversation.user1, conversation.user2],
      messages: conversation.messages,
    };
  }

  /**
   * Mark a message as read
   */
  @HandleError('Failed to mark message as read', 'PRIVATE_CHAT')
  async makePrivateMassageReadTrue(id: string) {
    return this.prisma.privateMessage.updateMany({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Delete a conversation
   */
  @HandleError('Failed to delete conversation', 'PRIVATE_CHAT')
  async deleteConversation(conversationId: string) {
    return this.prisma.privateConversation.deleteMany({
      where: { id: conversationId },
    });
  }
}
