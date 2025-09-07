import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ENVEnum } from '@project/common/enum/env.enum';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { SendPrivateMessageDto } from './dto/chat-gateway.dto';
import { ChatService } from './services/chat.service';

enum ChatEvents {
  ERROR = 'private:error',
  SUCCESS = 'private:success',
  NEW_MESSAGE = 'private:new_message',
  SEND_MESSAGE = 'private:send_message',
  NEW_CONVERSATION = 'private:new_conversation',
  CONVERSATION_LIST = 'private:conversation_list',
  LOAD_CONVERSATIONS = 'private:load_conversations',
  LOAD_SINGLE_CONVERSATION = 'private:load_single_conversation',
  LOAD_MESSAGES = 'private:load_messages',
  MESSAGES = 'private:messages',
  MARK_READ = 'private:mark_read',
  MESSAGE_STATUS = 'private:message_status',
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/api/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log(
      'Socket.IO server initialized FOR PRIVATE CHAT',
      server.adapter?.name ?? '',
    );
  }

  /** Handle socket connection and authentication */
  async handleConnection(client: Socket) {
    // Accept token either in Authorization header (Bearer) or handshake.auth.token
    const authHeader =
      (client.handshake.headers.authorization as string) ||
      (client.handshake.auth && (client.handshake.auth.token as string));
    if (!authHeader) {
      client.emit(ChatEvents.ERROR, {
        message: 'Missing authorization header',
      });
      client.disconnect(true);
      this.logger.warn('Missing auth header');
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;
    if (!token) {
      client.emit(ChatEvents.ERROR, { message: 'Missing token' });
      client.disconnect(true);
      this.logger.warn('Missing token');
      return;
    }

    try {
      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      });
      const userId = payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (!user) {
        client.emit(ChatEvents.ERROR, {
          message: 'User not found in database',
        });
        client.disconnect(true);
        this.logger.warn(`User not found: ${userId}`);
        return;
      }

      client.data.userId = userId;
      client.join(userId);
      client.emit(ChatEvents.SUCCESS, userId);
      this.logger.log(
        `Private chat: User ${userId} connected, socket ${client.id}`,
      );
    } catch (err: any) {
      client.emit(ChatEvents.ERROR, { message: err?.message ?? 'Auth failed' });
      client.disconnect(true);
      this.logger.warn(`Authentication failed: ${err?.message ?? err}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) client.leave(userId);
    this.logger.log(
      `Private chat disconnected: ${client.id} (user ${userId ?? 'unknown'})`,
    );
  }

  /** Load all conversations for the connected user */
  @SubscribeMessage(ChatEvents.LOAD_CONVERSATIONS)
  async handleLoadConversations(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit(ChatEvents.ERROR, { message: 'User not authenticated' });
      client.disconnect(true);
      this.logger.log('User not authenticated');
      return;
    }

    const res = await this.chatService.getUserConversations(userId);
    client.emit(ChatEvents.CONVERSATION_LIST, res?.data ?? []);
  }

  /** Load a single conversation (initial load: latest N messages) */
  @SubscribeMessage(ChatEvents.LOAD_SINGLE_CONVERSATION)
  async handleLoadSingleConversation(
    @MessageBody() body: { conversationId: string; limit?: number } | string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit(ChatEvents.ERROR, { message: 'User not authenticated' });
      client.disconnect(true);
      this.logger.log('User not authenticated');
      return;
    }

    const payload =
      typeof body === 'string'
        ? { conversationId: body, limit: undefined }
        : body;

    const conversationRes =
      await this.chatService.getPrivateConversationWithMessages(
        payload.conversationId,
        userId,
        payload.limit,
      );

    client.emit(ChatEvents.NEW_CONVERSATION, conversationRes?.data ?? null);
  }

  /**
   * Load messages with cursor-based pagination (scroll-up behavior).
   * Payload: { conversationId, limit?, beforeMessageId? }
   *
   * - initial load: beforeMessageId omitted -> returns latest `limit` messages (chronological)
   * - load previous: provide beforeMessageId -> returns older messages < beforeMessageId (chronological)
   */
  @SubscribeMessage(ChatEvents.LOAD_MESSAGES)
  async handleLoadMessages(
    @MessageBody()
    payload: {
      conversationId: string;
      limit?: number;
      beforeMessageId?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit(ChatEvents.ERROR, { message: 'User not authenticated' });
      client.disconnect(true);
      this.logger.log('User not authenticated');
      return;
    }

    const { conversationId, limit = 20, beforeMessageId } = payload;
    const res = await this.chatService.getConversationMessages(
      conversationId,
      limit,
      beforeMessageId,
    );

    client.emit(ChatEvents.MESSAGES, {
      conversationId,
      messages: res?.data ?? [],
      beforeMessageId,
    });
  }

  /** Send a message (create conversation if new) */
  @SubscribeMessage(ChatEvents.SEND_MESSAGE)
  async handleMessage(
    @MessageBody()
    payload:
      | {
          recipientId: string;
          dto: SendPrivateMessageDto;
          file?: any;
          userId: string;
        }
      | any,
    @ConnectedSocket() client: Socket,
  ) {
    const { recipientId, dto, file, userId } = payload;

    // Validate sender matches token
    if (client.data.userId !== userId) {
      client.emit(ChatEvents.ERROR, { message: 'User ID mismatch' });
      this.logger.warn(
        `User ID mismatch: client ${client.data.userId} vs payload ${userId}`,
      );
      return;
    }

    // Prevent sending to self
    if (userId === recipientId) {
      client.emit(ChatEvents.ERROR, {
        message: 'Cannot send message to yourself',
      });
      this.logger.log(`User ${userId} cannot send message to themselves`);
      return;
    }

    // Find existing conversation
    const convRes = await this.chatService.findConversation(
      userId,
      recipientId,
    );
    let conversation = convRes?.data ?? null;
    let isNewConversation = false;

    if (!conversation) {
      const createRes = await this.chatService.createConversation(
        userId,
        recipientId,
      );
      conversation = createRes?.data ?? null;
      isNewConversation = true;
    }

    if (!conversation) {
      client.emit(ChatEvents.ERROR, {
        message: 'Failed to get or create conversation',
      });
      this.logger.warn(
        `Failed to get/create conversation between ${userId} and ${recipientId}`,
      );
      return;
    }

    // Send message via service
    const messageRes = await this.chatService.sendPrivateMessage(
      conversation.id,
      userId,
      dto,
      file,
    );
    const message = messageRes?.data ?? null;
    if (!message) {
      client.emit(ChatEvents.ERROR, { message: 'Failed to send message' });
      this.logger.warn(
        `Failed to send message in conversation ${conversation.id}`,
      );
      return;
    }

    // Emit new message to both users (they are joined to rooms with their userId)
    this.server.to(userId).emit(ChatEvents.NEW_MESSAGE, message);
    this.server.to(recipientId).emit(ChatEvents.NEW_MESSAGE, message);

    // If this was a new conversation, refresh both users' chat lists
    if (isNewConversation) {
      const senderConversationsRes =
        await this.chatService.getUserConversations(userId);
      const recipientConversationsRes =
        await this.chatService.getUserConversations(recipientId);

      this.server
        .to(userId)
        .emit(ChatEvents.NEW_CONVERSATION, senderConversationsRes?.data ?? []);
      this.server
        .to(recipientId)
        .emit(
          ChatEvents.NEW_CONVERSATION,
          recipientConversationsRes?.data ?? [],
        );
    }
  }

  /**
   * Mark a message as read (for the current user) and broadcast status changes.
   * Payload: { messageId }
   */
  @SubscribeMessage(ChatEvents.MARK_READ)
  async handleMarkRead(
    @MessageBody() body: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit(ChatEvents.ERROR, { message: 'User not authenticated' });
      return;
    }

    const { messageId } = body;
    if (!messageId) {
      client.emit(ChatEvents.ERROR, { message: 'messageId is required' });
      return;
    }

    // Update status
    const updateRes = await this.chatService.markConversationMessagesAsRead(
      messageId,
      userId,
      new Date(),
    );

    // Fetch message to find conversation participants so we can broadcast status update
    const messageRecord = await this.prisma.privateMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          select: { user1Id: true, user2Id: true },
        },
      },
    });

    if (messageRecord && messageRecord.conversation) {
      const { user1Id, user2Id } = messageRecord.conversation;

      // Prepare a minimal payload for status update (the client can map it)
      const statusPayload = {
        messageId,
        userId,
        status: 'READ',
        updatedAt: new Date().toISOString(),
      };

      // Broadcast to both participants so both UIs can update status icons
      this.server.to(user1Id).emit(ChatEvents.MESSAGE_STATUS, statusPayload);
      this.server.to(user2Id).emit(ChatEvents.MESSAGE_STATUS, statusPayload);

      client.emit(ChatEvents.SUCCESS, updateRes?.data ?? null);
    } else {
      client.emit(ChatEvents.ERROR, {
        message: 'Message or conversation not found',
      });
    }
  }

  /** Helper for external services to emit new messages (keeps compatibility) */
  emitNewMessage(userId: string, message: any) {
    this.server.to(userId).emit(ChatEvents.NEW_MESSAGE, message);
  }
}
