import { Injectable, Logger } from '@nestjs/common';
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
import { LoadSingleConversationByAdminDto } from './dto/chat-gateway.dto';
import { ChatEventsEnum } from './enum/chat-events.enum';
import { CallService } from './services/call.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { WebRTCService } from './services/webrtc.service';
import { LoadConversationsPayload } from './types/conversation-payloads';
import {
  AdminMessagePayload,
  ClientMessagePayload,
} from './types/message-payloads';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/api/chat',
})
@Injectable()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly callService: CallService,
    private readonly webRTCService: WebRTCService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log(
      'Socket.IO server initialized FOR PRIVATE CHAT',
      server.adapter?.name ?? '',
    );
  }

  /** ---------------- AUTHENTICATION ---------------- */
  async handleConnection(client: Socket) {
    // Accept token either in Authorization header (Bearer) or handshake.auth.token
    const authHeader =
      (client.handshake.headers.authorization as string) ||
      (client.handshake.auth?.token as string);

    if (!authHeader) {
      client.emit(ChatEventsEnum.ERROR, {
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
      client.emit(ChatEventsEnum.ERROR, { message: 'Missing token' });
      client.disconnect(true);
      this.logger.warn('Missing token');
      return;
    }

    try {
      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, name: true, avatarUrl: true },
      });

      if (!user) return this.disconnectWithError(client, 'User not found');

      client.data.userId = user.id;
      client.data.role = user.role;
      client.join(user.id);

      this.logger.log(`User connected: ${user.id} (socket ${client.id})`);
      client.emit(ChatEventsEnum.SUCCESS, { userId: user.id });
    } catch (err: any) {
      this.disconnectWithError(client, err?.message ?? 'Auth failed');
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) client.leave(userId);
    this.logger.log(`Disconnected: ${client.id} (user ${userId ?? 'unknown'})`);
  }

  /** ---------------- MESSAGE EVENTS ---------------- */
  @SubscribeMessage(ChatEventsEnum.SEND_MESSAGE_CLIENT)
  async onSendMessageClient(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ClientMessagePayload,
  ) {
    return this.messageService.sendMessageFromClient(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.SEND_MESSAGE_ADMIN)
  async onSendMessageAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AdminMessagePayload,
  ) {
    return this.messageService.sendMessageFromAdmin(client, payload);
  }

  /** ---------------- MESSAGE EVENTS ---------------- **/
  @SubscribeMessage(ChatEventsEnum.LOAD_CONVERSATIONS)
  async onLoadConversationsForAdmins(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadConversationsPayload,
  ) {
    return this.conversationService.handleLoadConversationsForAdmins(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_SINGLE_CONVERSATION)
  async onLoadSingleConversationByAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadSingleConversationByAdminDto,
  ) {
    return this.conversationService.handleLoadSingleConversationByAdmin(
      client,
      payload,
    );
  }

  /** ---------------- HELPER EMITS ---------------- */
  private disconnectWithError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, { message });
    client.disconnect(true);
    this.logger.warn(`Disconnect ${client.id}: ${message}`);
  }

  public async emitToClient(
    conversationId: string,
    event: ChatEventsEnum,
    payload: any,
  ) {
    const clientParticipant =
      await this.prisma.privateConversationParticipant.findFirst({
        where: { conversationId, type: 'USER' },
        select: { userId: true },
      });

    if (clientParticipant) {
      this.server.to(clientParticipant.userId as string).emit(event, payload);
    }
  }
}
