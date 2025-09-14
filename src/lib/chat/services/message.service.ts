import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
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
  LoadMessagesPayload,
  MarkReadPayload,
  SendMessagePayload,
} from '../types/message-payloads';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to send message', 'MessageService')
  async handleSendMessage(
    client: Socket,
    payload: SendMessagePayload,
  ): Promise<TResponse<any>> {
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: payload.conversationId },
      include: { participants: true },
    });

    if (!conversation || conversation.participants.length === 0) {
      this.logger.error({
        message: 'Conversation not found',
        conversationId: payload.conversationId,
      });
      throw new AppError(404, 'Conversation not found');
    }

    const message = await this.prisma.privateMessage.create({
      data: {
        content: payload.content,
        type: payload.type || 'TEXT',
        fileId: payload.fileId,
        conversationId: payload.conversationId,
        senderId: client.data.userId,
      },
    });

    // Emit message to all participants via gateway helpers
    conversation.participants.forEach((p) => {
      if (p.userId)
        this.chatGateway.emitToUser(
          p.userId,
          ChatEventsEnum.NEW_MESSAGE,
          message,
        );
    });

    this.logger.log({
      message: 'New message sent',
      conversationId: payload.conversationId,
      senderId: client.data.userId,
      content: payload.content,
    });

    return successResponse(message, 'Message sent successfully');
  }

  @HandleError('Failed to load messages', 'MessageService')
  async handleLoadMessages(
    client: Socket,
    payload: LoadMessagesPayload,
  ): Promise<TResponse<any>> {
    const messages = await this.prisma.privateMessage.findMany({
      where: { conversationId: payload.conversationId },
      orderBy: { createdAt: 'asc' },
      take: payload.limit,
      cursor: payload.cursor ? { id: payload.cursor } : undefined,
    });

    this.logger.log({
      message: 'Messages loaded',
      conversationId: payload.conversationId,
    });

    return successResponse(messages, 'Messages loaded successfully');
  }

  @HandleError('Failed to mark message as read', 'MessageService')
  async handleMarkRead(
    client: Socket,
    payload: MarkReadPayload,
  ): Promise<TResponse<any>> {
    const message = await this.prisma.privateMessageStatus.update({
      where: {
        messageId_userId: {
          messageId: payload.messageId,
          userId: client.data.userId,
        },
      },
      data: { status: 'READ' },
    });

    this.logger.log({
      message: 'Message marked as read',
      messageId: payload.messageId,
      userId: client.data.userId,
    });

    return successResponse(message, 'Message marked as read successfully');
  }
}
