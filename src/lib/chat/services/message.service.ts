import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConversationParticipantType } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  errorResponse,
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { AdminMessageDto, ClientMessageDto } from '../dto/message.dto';
import { ChatEventsEnum } from '../enum/chat-events.enum';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Client → Admin(s)
   */
  @HandleError('Failed to send message to admin(s)', 'MessageService')
  async sendMessageFromClient(
    client: Socket,
    payload: ClientMessageDto,
  ): Promise<TResponse<any>> {
    const senderId = client.data.userId;
    if (!senderId) {
      client.emit(ChatEventsEnum.ERROR, { message: 'Unauthorized' });
      return errorResponse(null, 'Unauthorized');
    }

    const admins = await this.getAllAdminParticipants();

    // 1. Find or create conversation
    let conversation = payload.conversationId
      ? await this.prisma.privateConversation.findUnique({
          where: { id: payload.conversationId },
          include: { participants: true },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.privateConversation.create({
        data: {
          participants: {
            create: [{ userId: senderId, type: 'USER' }, ...admins],
          },
        },
        include: { participants: true },
      });
    }

    // 2. Save message
    const message = await this.prisma.privateMessage.create({
      data: {
        conversationId: conversation.id,
        content: payload.content,
        type: payload.type ?? 'TEXT',
        fileId: payload.fileId,
        senderId,
      },
    });

    // 3. Update last message of the conversation
    await this.prisma.privateConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageId: message.id,
      },
    });

    // 4. Save message status for all participants
    await Promise.all(
      conversation.participants.map((p) =>
        p.userId
          ? this.prisma.privateMessageStatus.create({
              data: { messageId: message.id, userId: p.userId },
            })
          : null,
      ),
    );

    // 5. Emit to all admins
    admins.forEach((admin) =>
      this.chatGateway.server
        .to(admin.userId)
        .emit(ChatEventsEnum.NEW_MESSAGE, message),
    );

    return successResponse(message, 'Message sent successfully');
  }

  /**
   * Admin → Client
   */
  @HandleError('Failed to send message to client', 'MessageService')
  async sendMessageFromAdmin(
    client: Socket,
    payload: AdminMessageDto,
  ): Promise<TResponse<any>> {
    const senderId = client.data.userId;
    if (!senderId) {
      client.emit(ChatEventsEnum.ERROR, { message: 'Unauthorized' });
      return errorResponse(null, 'Unauthorized');
    }

    const conversationId = payload.conversationId;
    if (!conversationId) {
      client.emit(ChatEventsEnum.ERROR, {
        message: 'Conversation ID is required',
      });
      return errorResponse(null, 'Conversation ID is required');
    }

    // 1. Find conversation and validate clientId with it
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      client.emit(ChatEventsEnum.ERROR, { message: 'Conversation not found' });
      return errorResponse(null, 'Conversation not found');
    }

    const clientId = conversation.participants.find(
      (p) => p.type === 'USER',
    )?.userId;
    if (clientId !== senderId) {
      client.emit(ChatEventsEnum.ERROR, { message: 'Unauthorized' });
      return errorResponse(null, 'Unauthorized');
    }

    // 2. Save message
    const message = await this.prisma.privateMessage.create({
      data: {
        conversationId: conversation.id,
        content: payload.content,
        type: payload.type ?? 'TEXT',
        fileId: payload.fileId,
        senderId,
      },
    });

    // 3. Update last message of the conversation
    await this.prisma.privateConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageId: message.id,
      },
    });

    // 4. Add admin to participants if not already there
    if (!conversation.participants.some((p) => p.userId === senderId)) {
      await this.prisma.privateConversation.update({
        where: { id: conversation.id },
        data: {
          participants: {
            create: { userId: senderId, type: 'ADMIN_GROUP' },
          },
        },
      });
    }

    // 5. Save message status for all participants
    await Promise.all(
      conversation.participants.map((p) =>
        p.userId
          ? this.prisma.privateMessageStatus.create({
              data: { messageId: message.id, userId: p.userId },
            })
          : null,
      ),
    );

    // 6. Emit to client only
    this.chatGateway.server
      .to(payload.clientId)
      .emit(ChatEventsEnum.NEW_MESSAGE, {
        message,
        fromAdmin: true,
      });

    return successResponse(message, 'Message sent successfully');
  }

  /**
   * Helper → get all admins as participants
   */
  private async getAllAdminParticipants() {
    const admins = await this.prisma.user.findMany({
      where: {
        OR: [{ role: 'ADMIN' }, { role: 'SUPER_ADMIN' }],
      },
      select: { id: true },
    });
    return admins.map((a) => ({
      userId: a.id,
      type: ConversationParticipantType.ADMIN_GROUP,
    }));
  }
}
