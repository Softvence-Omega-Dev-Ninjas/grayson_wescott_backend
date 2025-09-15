import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConversationParticipantType, MessageType } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  errorResponse,
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import {
  InitConversationWithClientDto,
  LoadConversationsDto,
  LoadSingleConversationDto,
} from '../dto/conversation.dto';
import { ChatEventsEnum } from '../enum/chat-events.enum';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to load conversations', 'ConversationService')
  async handleLoadConversationsByAdmin(
    client: Socket,
    payload?: LoadConversationsDto,
  ): Promise<TPaginatedResponse<any>> {
    // Pagination
    const limit = payload?.limit ?? 10;
    const page = payload?.page && +payload.page > 0 ? +payload.page : 1;

    // RAW Conversations
    const conversations = await this.prisma.privateConversation.findMany({
      include: {
        lastMessage: true,
        participants: {
          where: { type: 'USER' },
          include: { user: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: payload?.limit ?? 10,
      skip: (page - 1) * limit,
    });

    // Output
    const outputData = conversations.map((conversation) => {
      return {
        conversationId: conversation.id,
        lastMessage: conversation.lastMessage,
        profile: {
          id: conversation.participants[0].user?.id,
          name: conversation.participants[0].user?.name,
          avatarUrl: conversation.participants[0].user?.avatarUrl,
          role: conversation.participants[0].user?.role,
          email: conversation.participants[0].user?.email,
        },
      };
    });

    // Emit
    this.chatGateway.server
      .to(client.data.userId)
      .emit(ChatEventsEnum.CONVERSATION_LIST, {
        data: outputData,
        metadata: {
          limit,
          page,
          total: conversations.length,
          totalPage: Math.ceil(conversations.length / limit),
        },
      });

    // Response
    return successPaginatedResponse(
      outputData,
      {
        limit,
        page,
        total: conversations.length,
      },
      'Conversations loaded successfully',
    );
  }

  @HandleError('Failed to load single conversation', 'ConversationService')
  async handleLoadSingleConversationByAdmin(
    client: Socket,
    payload: LoadSingleConversationDto,
  ): Promise<TResponse<any>> {
    // Pagination
    const limit = payload?.limit ?? 10;
    const page = payload?.page && +payload.page > 0 ? +payload.page : 1;

    // Check if conversation ID is provided
    if (!payload.conversationId) {
      this.chatGateway.server
        .to(client.data.userId)
        .emit(ChatEventsEnum.ERROR, { message: 'Conversation ID is required' });
      return errorResponse(null, 'Conversation ID is required');
    }

    // RAW Conversation with participants + messages
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: payload.conversationId },
      include: {
        participants: {
          include: { user: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
          include: {
            sender: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // Check if conversation exists
    if (!conversation) {
      this.chatGateway.server
        .to(client.data.userId)
        .emit(ChatEventsEnum.ERROR, { message: 'Conversation not found' });

      return errorResponse(null, 'Conversation not found');
    }

    // Transform participants
    const participants = conversation.participants.map((p) => ({
      id: p.user?.id,
      name: p.user?.name,
      avatarUrl: p.user?.avatarUrl,
      role: p.user?.role,
      email: p.user?.email,
    }));

    // Transform messages
    const messages = conversation.messages.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt,
      sender: {
        id: m.sender?.id,
        name: m.sender?.name,
        avatarUrl: m.sender?.avatarUrl,
        role: m.sender?.role,
        email: m.sender?.email,
      },
    }));

    // Output
    const output = {
      conversationId: conversation.id,
      participants,
      messages,
      pagination: {
        limit,
        page,
        total: conversation._count.messages,
      },
    };

    // Emit event to requester only
    this.chatGateway.server
      .to(client.data.userId)
      .emit(ChatEventsEnum.SINGLE_CONVERSATION, output);

    return successResponse(output, 'Conversation loaded successfully');
  }

  @HandleError('Failed to init conversation with client', 'ConversationService')
  async handleInitConversationWithClient(
    client: Socket,
    payload: InitConversationWithClientDto,
  ): Promise<TResponse<any>> {
    const adminId = client.data.userId;
    const clientId = payload.clientId;

    const [conversation] = await this.prisma.$transaction(async (tx) => {
      // First, try to find an existing conversation with client as a user participant
      const existingConversation = await tx.privateConversation.findFirst({
        where: {
          participants: {
            some: {
              userId: clientId,
              type: ConversationParticipantType.USER,
            },
          },
        },
        include: {
          participants: true,
        },
      });

      let conversation;
      if (existingConversation) {
        conversation = existingConversation;
        const adminParticipant = existingConversation.participants.find(
          (p) => p.userId === adminId,
        );
        if (!adminParticipant) {
          await tx.privateConversation.update({
            where: { id: existingConversation.id },
            data: {
              participants: {
                create: {
                  userId: adminId,
                  type: ConversationParticipantType.ADMIN_GROUP,
                },
              },
            },
          });
        }
      } else {
        conversation = await tx.privateConversation.create({
          data: {
            participants: {
              create: [
                {
                  userId: adminId,
                  type: ConversationParticipantType.ADMIN_GROUP,
                },
                {
                  userId: clientId,
                  type: ConversationParticipantType.USER,
                },
              ],
            },
          },
        });

        // Add a starter message for new conversation
        const firstMessage = await tx.privateMessage.create({
          data: {
            content: 'Conversation started',
            type: MessageType.TEXT,
            senderId: adminId,
            conversationId: conversation.id,
          },
        });

        await tx.privateConversation.update({
          where: { id: conversation.id },
          data: { lastMessageId: firstMessage.id },
        });
      }

      return [conversation];
    });

    // Reuse loader to keep output in sync
    return this.handleLoadSingleConversationByAdmin(client, {
      conversationId: conversation.id,
      page: 1,
      limit: 10,
    });
  }

  @HandleError('Failed to load conversation of a client', 'ConversationService')
  async handleLoadClientConversation(
    client: Socket,
    payload: PaginationDto,
  ): Promise<TResponse<any>> {
    const limit = payload?.limit ?? 10;
    const page = payload?.page && +payload.page > 0 ? +payload.page : 1;

    // RAW Conversations
    const conversations = await this.prisma.privateConversation.findFirst({
      where: { participants: { some: { userId: client.data.userId } } },
      include: {
        lastMessage: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // OUTPUT
    const outputData = {
      messages: conversations?.messages.map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
        createdAt: m.createdAt,
        sender: {
          name: 'System Admin',
          avatarUrl:
            'https://ui-avatars.com/api/?name=System+Admin&background=random&color=fff',
          role: 'ADMIN',
        },
      })),
      pagination: {
        limit,
        page,
        total: conversations?.messages.length,
      },
    };

    // Emit
    this.chatGateway.server
      .to(client.data.userId)
      .emit(ChatEventsEnum.CLIENT_CONVERSATION, outputData);

    // Response
    return successResponse(outputData, 'Conversations loaded successfully');
  }
}
