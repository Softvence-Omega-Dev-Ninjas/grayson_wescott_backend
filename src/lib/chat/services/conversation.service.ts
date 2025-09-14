import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { ChatEventsEnum } from '../enum/chat-events.enum';
import {
  LoadConversationsPayload,
  LoadSingleConversationPayload,
  NewConversationPayload,
} from '../types/conversation-payloads';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /** Initialize a new conversation or return existing */
  @HandleError('Failed to create conversation', 'ConversationService')
  async handleNewConversation(
    client: Socket,
    payload: NewConversationPayload,
  ): Promise<TResponse<any>> {
    const participantIds = [payload.userId, payload.adminGroupId];
    const userId = payload.userId;
    const adminGroupId = payload.adminGroupId;

    // Check for existing conversation between admin group and user
    const existing = await this.prisma.privateConversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: participantIds } },
        },
      },
      include: { participants: true, lastMessage: true },
    });

    if (existing) {
      client.emit(ChatEventsEnum.NEW_CONVERSATION, existing);
      return successResponse(existing, 'Conversation already exists');
    }

    // Create new conversation
    const conversation = await this.prisma.privateConversation.create({
      data: {
        participants: {
          create: [
            { userId, type: 'USER' },
            { userId: adminGroupId, type: 'ADMIN_GROUP' },
          ],
        },
      },
      include: { participants: true },
    });

    // Optional initial message
    if (payload.initialMessage) {
      const message = await this.prisma.privateMessage.create({
        data: {
          content: payload.initialMessage,
          conversationId: conversation.id,
          senderId: client.data.userId,
        },
      });

      await this.prisma.privateConversation.update({
        where: { id: conversation.id },
        data: { lastMessageId: message.id },
      });
    }

    // Emit to all participants
    participantIds.forEach((uid) => {
      this.chatGateway.emitToClient(
        uid,
        ChatEventsEnum.NEW_CONVERSATION,
        conversation,
      );
    });

    this.logger.log({
      message: 'Conversation created',
      userId,
      adminGroupId,
    });

    return successResponse(conversation, 'Conversation created');
  }

  @HandleError('Failed to load conversations', 'ConversationService')
  async handleLoadConversations(
    client: Socket,
    payload?: LoadConversationsPayload,
  ): Promise<TResponse<any>> {
    const conversations = await this.prisma.privateConversation.findMany({
      where: {
        participants: { some: { userId: client.data.userId } },
      },
      orderBy: { updatedAt: 'desc' },
      take: payload?.limit,
      cursor: payload?.cursor ? { id: payload.cursor } : undefined,
    });

    this.logger.log({
      message: 'Conversations loaded',
      userId: client.data.userId,
    });

    return successResponse(conversations, 'Conversations loaded successfully');
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
      throw new Error('Conversation not found');
    }

    this.logger.log({
      message: 'Conversation loaded',
      conversationId: payload.conversationId,
      userId: client.data.userId,
    });

    return successResponse(conversation, 'Conversation loaded successfully');
  }
}
