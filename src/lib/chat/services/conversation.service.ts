import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
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
      outputData,
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
  async handleLoadSingleConversation(
    client: Socket,
    payload: LoadSingleConversationPayload,
  ): Promise<TResponse<any>> {
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: payload.conversationId },
      include: { participants: true, messages: true },
    });

    if (!conversation) {
      this.logger.error({
        message: 'Conversation not found',
        conversationId: payload.conversationId,
      });
      throw new AppError(404, 'Conversation not found');
    }

    return successResponse(conversation, 'Conversation loaded successfully');
  }
}
