import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ConversationParticipantType,
  MessageDeliveryStatus,
  MessageType,
} from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  errorResponse,
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import {
  AdminMessageDto,
  ClientMessageDto,
  MarkReadDto,
  MessageDeliveryStatusDto,
} from '../dto/message.dto';
import { ChatEventsEnum } from '../enum/chat-events.enum';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * =======================
   * Public API
   * =======================
   */
  @HandleError('Failed to send message to admin(s)', 'MessageService')
  async sendMessageFromClient(
    client: Socket,
    payload: ClientMessageDto,
  ): Promise<TResponse<any>> {
    const senderId = client.data.userId;
    if (!senderId) return this.emitError(client, 'Unauthorized');

    const admins = await this.getAllAdminParticipants();

    // Ensure conversation exists or create a new one
    const conversation = await this.prisma.privateConversation.upsert({
      where: { id: payload.conversationId || 'non-existent-id' }, // * a dummy id if none is provided; important to complete the upsert
      update: {}, // * do nothing if it exists
      create: {
        participants: {
          create: [
            { userId: senderId, type: ConversationParticipantType.USER },
            ...admins,
          ],
        },
      },
      include: { participants: true },
    });

    const message = await this.createMessage(
      conversation.id,
      senderId,
      payload.content,
      payload.type,
      payload.fileId,
    );

    await this.updateConversationAndStatuses(conversation.id, message.id, [
      ...conversation.participants.map((p) => p.userId!),
    ]);

    // Notify admins + client
    this.emitToAdmins(admins, ChatEventsEnum.NEW_MESSAGE, message);
    client.emit(ChatEventsEnum.NEW_MESSAGE, message);

    return successResponse(message, 'Message sent successfully');
  }

  @HandleError('Failed to send message to client', 'MessageService')
  async sendMessageFromAdmin(
    client: Socket,
    payload: AdminMessageDto,
  ): Promise<TResponse<any>> {
    const senderId = client.data.userId;
    if (!senderId) return this.emitError(client, 'Unauthorized');
    if (!payload.conversationId) {
      return this.emitError(client, 'Conversation ID is required');
    }

    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: payload.conversationId },
      include: { participants: true },
    });
    if (!conversation) return this.emitError(client, 'Conversation not found');

    const clientId = conversation.participants.find(
      (p) => p.type === ConversationParticipantType.USER,
    )?.userId;
    if (!clientId)
      return this.emitError(client, 'Client not found in conversation');

    const message = await this.createMessage(
      conversation.id,
      senderId,
      payload.content,
      payload.type,
      payload.fileId,
    );

    // Ensure admin is part of conversation
    const newAdmin =
      conversation.participants.some((p) => p.userId === senderId) === false
        ? [{ userId: senderId, type: ConversationParticipantType.ADMIN_GROUP }]
        : [];

    const participantIds = [
      ...conversation.participants.map((p) => p.userId!),
      ...newAdmin.map((p) => p.userId!),
    ];

    await this.updateConversationAndStatuses(
      conversation.id,
      message.id,
      participantIds,
      newAdmin,
    );

    // Notify client + admins
    this.chatGateway.server
      .to(clientId)
      .emit(ChatEventsEnum.NEW_MESSAGE, { message, fromAdmin: true });

    const admins = await this.getAllAdminParticipants();
    this.emitToAdmins(admins, ChatEventsEnum.NEW_MESSAGE, {
      message,
      fromAdmin: true,
    });

    // If client online → mark delivered
    if (this.isClientOnline(clientId)) {
      this.emitDeliveryStatus(admins, clientId, message.id, senderId);
    }

    return successResponse(message, 'Message sent successfully');
  }

  @HandleError('Failed to update message status', 'MessageService')
  async messageStatusUpdate(
    client: Socket,
    payload: MessageDeliveryStatusDto,
  ): Promise<TResponse<any>> {
    const { messageId, userId: payloadUserId, status } = payload;
    const userId = payloadUserId ?? client.data.userId;

    const messageStatus = await this.prisma.privateMessageStatus.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { status },
      create: { messageId, userId, status },
    });

    const updatePayload = {
      messageId,
      userId,
      status: messageStatus.status,
    };

    return successResponse(updatePayload, 'Message status updated');
  }

  @HandleError('Failed to mark message(s) as read', 'MessageService')
  async markMessagesAsRead(payload: MarkReadDto): Promise<TResponse<any>> {
    const message = await this.prisma.privateMessageStatus.updateMany({
      where: { messageId: { in: payload.messageIds } },
      data: { status: MessageDeliveryStatus.READ },
    });

    return successResponse(message, 'Message marked as read');
  }

  /**
   * =======================
   * Helpers
   * =======================
   */
  private async createMessage(
    conversationId: string,
    senderId: string,
    content: string = '',
    type: MessageType = 'TEXT',
    fileId?: string,
  ) {
    return this.prisma.privateMessage.create({
      data: { conversationId, senderId, content, type, fileId },
    });
  }

  private async updateConversationAndStatuses(
    conversationId: string,
    messageId: string,
    participantIds: string[],
    newParticipants: {
      userId: string;
      type: ConversationParticipantType;
    }[] = [],
  ) {
    await this.prisma.$transaction([
      this.prisma.privateConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: messageId,
          participants: { create: newParticipants },
        },
      }),
      ...participantIds.map((id) =>
        this.prisma.privateMessageStatus.create({
          data: { messageId, userId: id },
        }),
      ),
    ]);
  }

  private async getAllAdminParticipants() {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });
    return admins.map((a) => ({
      userId: a.id,
      type: ConversationParticipantType.ADMIN_GROUP,
    }));
  }

  private emitError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, { message });
    return errorResponse(null, message);
  }

  private emitToAdmins(
    admins: { userId: string }[],
    event: ChatEventsEnum,
    payload: any,
  ) {
    admins.forEach((admin) =>
      this.chatGateway.server.to(admin.userId).emit(event, payload),
    );
  }

  private isClientOnline(clientId: string): boolean {
    const sockets = this.chatGateway.server.sockets.adapter.rooms.get(clientId);
    return !!sockets?.size;
  }

  private emitDeliveryStatus(
    admins: { userId: string }[],
    clientId: string,
    messageId: string,
    senderId: string,
  ) {
    const payload = {
      messageId,
      userId: senderId,
      status: MessageDeliveryStatus.DELIVERED,
    };

    this.chatGateway.server
      .to(clientId)
      .emit(ChatEventsEnum.UPDATE_MESSAGE_STATUS, payload);
    this.emitToAdmins(admins, ChatEventsEnum.UPDATE_MESSAGE_STATUS, payload);
  }
}
