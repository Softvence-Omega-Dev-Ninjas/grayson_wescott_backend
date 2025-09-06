import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { PrismaService } from '@project/lib/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
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
    private readonly ChatService: ChatService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log(
      'Socket.IO server initialized FOR PRIVATE CHAT',
      server.adapter.name,
    );
  }

  /** Handle socket connection and authentication */
  async handleConnection(client: Socket) {
    const authHeader =
      client.handshake.headers.authorization || client.handshake.auth?.token;
    if (!authHeader) {
      client.emit(ChatEvents.ERROR, {
        message: 'Missing authorization header',
      });
      client.disconnect(true);
      this.logger.warn('Missing auth header');
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      client.emit(ChatEvents.ERROR, { message: 'Missing token' });
      client.disconnect(true);
      this.logger.warn('Missing token');
      return;
    }

    try {
      const jwtSecret = this.configService.get<string>(ENVEnum.JWT_SECRET);
      const payload: any = jwt.verify(token, jwtSecret as string);
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
    } catch (err) {
      client.emit(ChatEvents.ERROR, { message: err.message });
      client.disconnect(true);
      this.logger.warn(`Authentication failed: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    client.leave(client.data.userId);
    client.emit(ChatEvents.ERROR, { message: 'Disconnected' });
    this.logger.log(`Private chat disconnected: ${client.id}`);
  }

  /** Load all conversations for the connected user */
  @SubscribeMessage(ChatEvents.LOAD_CONVERSATIONS)
  async handleLoadConversations(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit(ChatEvents.ERROR, {
        message: 'User not authenticated',
      });
      client.disconnect(true);
      this.logger.log('User not authenticated');
      return;
    }

    const conversations = await this.ChatService.getUserConversations(userId);
    client.emit(ChatEvents.CONVERSATION_LIST, conversations);
  }

  /** Load a single conversation */
  @SubscribeMessage(ChatEvents.LOAD_SINGLE_CONVERSATION)
  async handleLoadSingleConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit(ChatEvents.ERROR, {
        message: 'User not authenticated',
      });
      client.disconnect(true);
      this.logger.log('User not authenticated');
      return;
    }

    const conversation =
      await this.ChatService.getPrivateConversationWithMessages(
        conversationId,
        userId,
      );
    client.emit(ChatEvents.NEW_CONVERSATION, conversation);
  }

  /** Send a message (create conversation if new) */
  @SubscribeMessage(ChatEvents.SEND_MESSAGE)
  async handleMessage(
    @MessageBody()
    payload: {
      recipientId: string;
      dto: SendPrivateMessageDto;
      file?: Express.Multer.File;
      userId: string;
    },
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
    let conversation = await this.ChatService.findConversation(
      userId,
      recipientId,
    );

    let isNewConversation = false;
    if (!conversation) {
      conversation = await this.ChatService.createConversation(
        userId,
        recipientId,
      );
      isNewConversation = true;
    }

    // Send message
    const message = await this.ChatService.sendPrivateMessage(
      conversation.data.id,
      userId,
      dto,
      file,
    );

    // Emit new message to both users
    this.server.to(userId).emit(ChatEvents.NEW_MESSAGE, message);
    this.server.to(recipientId).emit(ChatEvents.NEW_MESSAGE, message);

    // If this was a new conversation, refresh both users' chat lists
    if (isNewConversation) {
      const senderConversations =
        await this.ChatService.getUserConversations(userId);
      const recipientConversations =
        await this.ChatService.getUserConversations(recipientId);

      this.server
        .to(userId)
        .emit(ChatEvents.NEW_CONVERSATION, senderConversations);
      this.server
        .to(recipientId)
        .emit(ChatEvents.NEW_CONVERSATION, recipientConversations);
    }
  }

  /** Helper for external services to emit new messages */
  emitNewMessage(userId: string, message: any) {
    this.server.to(userId).emit(ChatEvents.NEW_MESSAGE, message);
  }
}
