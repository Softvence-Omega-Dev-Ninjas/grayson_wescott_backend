import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ConversationParticipantType,
  MessageDeliveryStatus,
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

  // Send message to admin(s)
  @HandleError('Failed to send message to admin(s)', 'MessageService')
  async sendMessageFromClient(
    client: Socket,
    payload: ClientMessageDto,
  ): Promise<TResponse<any>> {
    const senderId = client.data.userId;
    if (!senderId) return this.emitError(client, 'Unauthorized');

    const admins = await this.getAllAdminParticipants();

    // Find or create conversation in one go using upsert if payload.conversationId exists
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

    // Save message
    const message = await this.prisma.privateMessage.create({
      data: {
        conversationId: conversation.id,
        content: payload.content,
        type: payload.type ?? 'TEXT',
        fileId: payload.fileId,
        senderId,
      },
    });

    // Update last message and create message statuses in a single transaction
    const participantStatuses = conversation.participants
      .filter((p) => p.userId)
      .map((p) => ({ messageId: message.id, userId: p.userId! }));

    await this.prisma.$transaction([
      this.prisma.privateConversation.update({
        where: { id: conversation.id },
        data: { lastMessageId: message.id },
      }),
      ...participantStatuses.map((status) =>
        this.prisma.privateMessageStatus.create({ data: status }),
      ),
    ]);

    // Emit to all admins
    admins.forEach((admin) =>
      this.chatGateway.server
        .to(admin.userId)
        .emit(ChatEventsEnum.NEW_MESSAGE, message),
    );

    // Emit to client
    client.emit(ChatEventsEnum.NEW_MESSAGE, message);

    return successResponse(message, 'Message sent successfully');
  }

  // Send message to client
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
    if (!clientId) {
      return this.emitError(client, 'Client not found in conversation');
    }

    // Save message
    const message = await this.prisma.privateMessage.create({
      data: {
        conversationId: conversation.id,
        content: payload.content,
        type: payload.type ?? 'TEXT',
        fileId: payload.fileId,
        senderId,
      },
    });

    // Add admin participant if not exists
    const newParticipants = conversation.participants.some(
      (p) => p.userId === senderId,
    )
      ? []
      : [{ userId: senderId, type: ConversationParticipantType.ADMIN_GROUP }];

    // Batch update last message, add new participants, and create message statuses
    const participantStatuses = [
      ...conversation.participants.map((p) => ({
        messageId: message.id,
        userId: p.userId!,
      })),
      ...newParticipants.map((p) => ({
        messageId: message.id,
        userId: p.userId!,
      })),
    ];

    await this.prisma.$transaction([
      this.prisma.privateConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageId: message.id,
          participants: { create: newParticipants },
        },
      }),
      ...participantStatuses.map((status) =>
        this.prisma.privateMessageStatus.create({ data: status }),
      ),
    ]);

    // Emit to client
    this.chatGateway.server
      .to(clientId) // emits to the room with that userId
      .emit(ChatEventsEnum.NEW_MESSAGE, { message, fromAdmin: true });

    // Emit to all admins
    const admins = await this.getAllAdminParticipants();
    admins.forEach((admin) =>
      this.chatGateway.server
        .to(admin.userId)
        .emit(ChatEventsEnum.NEW_MESSAGE, { message, fromAdmin: true }),
    );

    // Mark message as delivered if client is online & for all active clients
    const clientSockets =
      this.chatGateway.server.sockets.adapter.rooms.get(clientId);
    if (clientSockets && clientSockets.size > 0) {
      this.chatGateway.server
        .to(clientId)
        .emit(ChatEventsEnum.UPDATE_MESSAGE_STATUS, {
          messageId: message.id,
          userId: senderId,
          status: MessageDeliveryStatus.DELIVERED,
        });

      // Emit to all admins
      admins.forEach((admin) =>
        this.chatGateway.server
          .to(admin.userId)
          .emit(ChatEventsEnum.UPDATE_MESSAGE_STATUS, {
            messageId: message.id,
            userId: senderId,
            status: MessageDeliveryStatus.DELIVERED,
          }),
      );
    }

    return successResponse(message, 'Message sent successfully');
  }

  // Update message status
  @HandleError('Failed to update message status', 'MessageService')
  async messageStatusUpdate(
    client: Socket,
    payload: MessageDeliveryStatusDto,
  ): Promise<TResponse<any>> {
    const { messageId, userId: payloadUserId, status } = payload;
    const userId = payloadUserId ?? client.data.userId;

    await this.prisma.privateMessageStatus.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { status },
      create: { messageId, userId, status },
    });

    // Broadcast the update back to the requester (and optionally to admins)
    client.emit(ChatEventsEnum.UPDATE_MESSAGE_STATUS, {
      messageId,
      userId,
      status,
    });

    // notify admins about status change so UI can update
    const admins = await this.getAllAdminParticipants();
    admins.forEach((admin) =>
      this.chatGateway.server
        .to(admin.userId)
        .emit(ChatEventsEnum.UPDATE_MESSAGE_STATUS, {
          messageId,
          userId,
          status,
        }),
    );

    return successResponse(
      { messageId, userId, status },
      'Message status updated',
    );
  }

  // Mark message(s) as read
  @HandleError('Failed to mark message(s) as read', 'MessageService')
  async markMessagesAsRead(payload: MarkReadDto): Promise<TResponse<any>> {
    await this.prisma.privateMessageStatus.updateMany({
      where: { messageId: { in: payload.messageIds } },
      data: { status: MessageDeliveryStatus.READ },
    });
    return successResponse(null, 'Message marked as read');
  }

  /**
   *  Helper functions
   */
  // Get all admin participants
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

  // Emit error
  private emitError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, { message });
    return errorResponse(null, message);
  }
}
