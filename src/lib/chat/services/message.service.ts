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
import { QUEUE_EVENTS } from '@project/lib/queue/interface/queue-events';
import { Socket } from 'socket.io';
import { EventsEnum } from '../../../common/enum/events.enum';
import { ChatGateway } from '../chat.gateway';
import {
  AdminMessageDto,
  ClientMessageDto,
  MarkReadDto,
  MessageDeliveryStatusDto,
} from '../dto/message.dto';

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

    // Find or create conversation
    let conversation = await this.prisma.privateConversation.findFirst({
      where: {
        participants: {
          some: {
            userId: senderId,
            type: ConversationParticipantType.USER,
          },
        },
      },
      include: { participants: true },
    });

    if (!conversation) {
      conversation = await this.prisma.privateConversation.create({
        data: {
          participants: {
            create: [
              { userId: senderId, type: ConversationParticipantType.USER },
            ],
          },
        },
        include: { participants: true },
      });
    }

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

    const formattedMessage = this.formatMessageForClient(message, senderId);

    // Notify admins + client
    this.emitMessageToAdmins(
      admins,
      EventsEnum.NEW_MESSAGE,
      message,
      'New message received from client',
    );

    this.emitMessageToClient(
      client.data.userId,
      EventsEnum.NEW_MESSAGE,
      message,
      'New message received from client',
    );

    return successResponse(
      { conversationId: conversation.id, message: formattedMessage },
      'Message sent successfully',
    );
  }

  @HandleError('Failed to send message to client', 'MessageService')
  async sendMessageFromAdmin(
    client: Socket,
    payload: AdminMessageDto,
  ): Promise<TResponse<any>> {
    const senderId = client.data.userId;
    if (!senderId) return this.emitError(client, 'Unauthorized');

    const conversation = await this.prisma.privateConversation.findFirst({
      where: {
        participants: {
          some: {
            userId: payload.clientId,
            type: ConversationParticipantType.USER,
          },
        },
      },
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

    // Store the message as notification
    if (payload.type === MessageType.TEXT && payload.content) {
      await this.prisma.notification.create({
        data: {
          users: {
            createMany: {
              data: participantIds.map((id) => ({ userId: id })),
            },
          },
          title: 'New message from trainer',
          message: payload.content,
          type: QUEUE_EVENTS.MESSAGES,
          meta: {
            conversationId: conversation.id,
            messageId: message.id,
          },
        },
      });
    }

    const formattedMessage = this.formatMessageForClient(message, clientId);

    // Notify client + admins
    this.emitMessageToClient(
      clientId,
      EventsEnum.NEW_MESSAGE,
      message,
      'New message from admin',
    );

    const admins = await this.getAllAdminParticipants();

    this.emitMessageToAdmins(
      admins,
      EventsEnum.NEW_MESSAGE,
      message,
      'New message from admin',
    );

    // If client online → mark delivered
    if (this.chatGateway.isOnline(clientId)) {
      this.emitDeliveryStatus(admins, clientId, message.id, senderId);
    }

    return successResponse(
      { conversationId: conversation.id, message: formattedMessage },
      'Message sent successfully',
    );
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

    return successResponse({ status: updatePayload }, 'Message status updated');
  }

  @HandleError('Failed to mark message(s) as read', 'MessageService')
  async markMessagesAsRead(payload: MarkReadDto): Promise<TResponse<any>> {
    const message = await this.prisma.privateMessageStatus.updateMany({
      where: { messageId: { in: payload.messageIds } },
      data: { status: MessageDeliveryStatus.READ },
    });

    return successResponse(
      { read: { updatedCount: message.count } },
      'Messages marked as read',
    );
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
      include: {
        file: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
            role: true,
          },
        },
      },
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
    this.chatGateway.server
      .to(client.data.userId)
      .emit(EventsEnum.ERROR, errorResponse(null, message));
    return errorResponse(null, message);
  }

  private emitToAdmins(
    admins: { userId: string }[],
    event: EventsEnum,
    payload: any,
    message: string,
  ) {
    admins.forEach((admin) =>
      this.chatGateway.server
        .to(admin.userId)
        .emit(event, successResponse(payload, message)),
    );
  }

  private emitToClient(
    clientId: string,
    event: EventsEnum,
    payload: any,
    message: string,
  ) {
    this.chatGateway.server
      .to(clientId)
      .emit(event, successResponse(payload, message));
  }

  // emit a message object to all admins, formatting per admin
  private emitMessageToAdmins(
    admins: { userId: string }[],
    event: EventsEnum,
    message: any,
    messageText: string,
  ) {
    admins.forEach((admin) => {
      const formatted = this.formatMessageForClient(message, admin.userId);
      this.chatGateway.server
        .to(admin.userId)
        .emit(event, successResponse(formatted, messageText));
    });
  }

  // emit a message object to a single client, formatting for that client
  private emitMessageToClient(
    clientId: string,
    event: EventsEnum,
    message: any,
    messageText: string,
  ) {
    const formatted = this.formatMessageForClient(message, clientId);
    this.chatGateway.server
      .to(clientId)
      .emit(event, successResponse(formatted, messageText));
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
      .emit(
        EventsEnum.UPDATE_MESSAGE_STATUS,
        successResponse(payload, 'Your message has been delivered'),
      );
    this.emitToAdmins(
      admins,
      EventsEnum.UPDATE_MESSAGE_STATUS,
      payload,
      'Your message has been delivered',
    );
  }

  private formatMessageForClient(message: any, viewerId: string) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      type: 'MESSAGE',
      createdAt: message.createdAt,
      content: message.content,
      messageType: message.type,
      sender: message.sender
        ? {
            id: message.sender.id,
            name: message.sender.name,
            avatarUrl: message.sender.avatarUrl,
            role: message.sender.role,
            email: message.sender.email,
          }
        : null,
      file: message.file
        ? {
            id: message.file.id,
            url: message.file.url,
            type: message.file.fileType,
            mimeType: message.file.mimeType,
          }
        : null,
      // viewerId is the *recipient* user id — `isMine` is true only for that recipient.
      isMine: message.sender?.id === viewerId,
      // isSentByClient should indicate whether the message was sent by a client (user),
      // not whether the recipient is the same as sender.
      isSentByClient: message.sender?.role === 'USER',
    };
  }
}
