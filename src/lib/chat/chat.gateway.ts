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
import { ChatEventsEnum } from './enum/chat-events.enum';
import { CallService } from './services/call.service';
import { MessageService } from './services/message.service';
import { WebRTCService } from './services/webrtc.service';
import {
  LoadMessagesPayload,
  MarkReadPayload,
  SendMessagePayload,
} from './types/message-payloads';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/api/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly messageService: MessageService,
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

  /** Handle socket connection and authentication */
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
      const userId = payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        client.emit(ChatEventsEnum.ERROR, { message: 'User not found' });
        client.disconnect(true);
        this.logger.warn(`User not found: ${userId}`);
        return;
      }

      client.data.userId = userId;
      client.join(userId);
      client.emit(ChatEventsEnum.SUCCESS, userId);
      this.logger.log(`User ${userId} connected, socket ${client.id}`);
    } catch (err: any) {
      client.emit(ChatEventsEnum.ERROR, {
        message: err?.message ?? 'Auth failed',
      });
      client.disconnect(true);
      this.logger.warn(`Authentication failed: ${err?.message ?? err}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) client.leave(userId);
    this.logger.log(`Disconnected: ${client.id} (user ${userId ?? 'unknown'})`);
  }

  // ================== MESSAGE EVENTS ==================
  @SubscribeMessage(ChatEventsEnum.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    return this.messageService.handleSendMessage(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_MESSAGES)
  async handleLoadMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadMessagesPayload,
  ) {
    return this.messageService.handleLoadMessages(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadPayload,
  ) {
    return this.messageService.handleMarkRead(client, payload);
  }

  // ================== CONVERSATION EVENTS ==================
  @SubscribeMessage(ChatEventsEnum.LOAD_CONVERSATIONS)
  async handleLoadConversations(@ConnectedSocket() client: Socket) {
    this.logger.log(`LOAD_CONVERSATIONS requested by ${client.data.userId}`);
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_SINGLE_CONVERSATION)
  async handleLoadSingleConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(
      `LOAD_SINGLE_CONVERSATION for ${client.data.userId}`,
      payload,
    );
  }

  // ================== CALL EVENTS ==================
  @SubscribeMessage(ChatEventsEnum.CALL_INITIATE)
  async handleCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_INITIATE by ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_ACCEPT)
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_ACCEPT by ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_REJECT)
  async handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_REJECT by ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_JOIN)
  async handleCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_JOIN by ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_LEAVE)
  async handleCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_LEAVE by ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_END)
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_END triggered`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_MISSED)
  async handleCallMissed(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`CALL_MISSED for ${client.data.userId}`, payload);
  }

  // ================== WEBRTC SIGNALING EVENTS ==================
  @SubscribeMessage(ChatEventsEnum.WEBRTC_OFFER)
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`WEBRTC_OFFER from ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.WEBRTC_ANSWER)
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`WEBRTC_ANSWER from ${client.data.userId}`, payload);
  }

  @SubscribeMessage(ChatEventsEnum.WEBRTC_ICE_CANDIDATE)
  async handleWebRTCIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`WEBRTC_ICE_CANDIDATE from ${client.data.userId}`, payload);
  }

  // ================== HELPER TO EMIT EVENTS ==================
  emitToUser(userId: string, event: ChatEventsEnum, payload: any) {
    this.server.to(userId).emit(event, payload);
  }

  emitToRoom(roomId: string, event: ChatEventsEnum, payload: any) {
    this.server.to(roomId).emit(event, payload);
  }
}
