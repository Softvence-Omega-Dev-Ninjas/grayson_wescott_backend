import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
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
import { ChatEventsEnum } from '../enum/chat-events.enum';
import {
  LoadConversationsPayload,
  LoadSingleConversationPayload,
} from '../types/conversation-payloads';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to load conversations', 'ConversationService')
  async handleLoadConversationsForAdmins(
    client: Socket,
    payload?: LoadConversationsPayload,
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
    this.chatGateway.server.emit(
      ChatEventsEnum.CONVERSATION_LIST,
      {
        data: outputData,
        metadata: {
          limit,
          page,
          total: conversations.length,
          totalPage: Math.ceil(conversations.length / limit),
        },
      },
      client.data.userId,
    );

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
    payload: LoadSingleConversationPayload,
  ): Promise<TResponse<any>> {
    // Pagination
    const limit = payload?.limit ?? 10;
    const page = payload?.page && +payload.page > 0 ? +payload.page : 1;

    // Check if conversation ID is provided
    if (!payload.conversationId) {
      this.chatGateway.server.emit(
        ChatEventsEnum.ERROR,
        { message: 'Conversation ID is required' },
        client.data.userId,
      );
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
      this.chatGateway.server.emit(
        ChatEventsEnum.ERROR,
        { message: 'Conversation not found' },
        client.data.userId,
      );
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
      .emit(ChatEventsEnum.CONVERSATION_LOAD, output);

    return successResponse(output, 'Conversation loaded successfully');
  }
}
