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
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { ENVEnum } from '@project/common/enum/env.enum';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { errorResponse } from './../../common/utils/response.util';
import { CallActionDto, InitiateCallDto } from './dto/call.dto';
import {
  InitConversationWithClientDto,
  LoadConversationsDto,
  LoadSingleConversationDto,
} from './dto/conversation.dto';
import {
  AdminMessageDto,
  ClientMessageDto,
  MarkReadDto,
  MessageDeliveryStatusDto,
} from './dto/message.dto';
import { ChatEventsEnum } from './enum/chat-events.enum';
import { CallService } from './services/call.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { WebRTCService } from './services/webrtc.service';

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
    @MessageBody() payload: ClientMessageDto,
  ) {
    return this.messageService.sendMessageFromClient(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.SEND_MESSAGE_ADMIN)
  async onSendMessageAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AdminMessageDto,
  ) {
    return this.messageService.sendMessageFromAdmin(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.UPDATE_MESSAGE_STATUS)
  async onMessageStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageDeliveryStatusDto,
  ) {
    return this.messageService.messageStatusUpdate(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.MARK_MESSAGE_READ)
  async onMarkMessagesAsRead(@MessageBody() payload: MarkReadDto) {
    return this.messageService.markMessagesAsRead(payload);
  }

  /** ---------------- CONVERSATION EVENTS ---------------- **/
  @SubscribeMessage(ChatEventsEnum.LOAD_CONVERSATION_LIST)
  async onLoadConversationsByAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadConversationsDto,
  ) {
    return this.conversationService.handleLoadConversationsByAdmin(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_SINGLE_CONVERSATION)
  async onLoadSingleConversationByAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadSingleConversationDto,
  ) {
    return this.conversationService.handleLoadSingleConversationByAdmin(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_CLIENT_CONVERSATION)
  async onLoadClientConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PaginationDto,
  ) {
    return this.conversationService.handleLoadClientConversation(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.INIT_CONVERSATION_WITH_CLIENT)
  async onInitConversationWithClient(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: InitConversationWithClientDto,
  ) {
    return this.conversationService.handleInitConversationWithClient(
      client,
      payload,
    );
  }

  /** ---------------- CALL EVENTS & WEBRTC ---------------- **/
  @SubscribeMessage(ChatEventsEnum.CALL_INITIATE)
  async onCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: InitiateCallDto,
  ) {
    return await this.callService.initiateCall(client, data);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_ACCEPT)
  async onCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    return await this.callService.acceptCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_REJECT)
  async onCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    return await this.callService.rejectCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_JOIN)
  async onCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    return await this.callService.joinCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_LEAVE)
  async onCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    return await this.callService.leaveCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_END)
  async onCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    return await this.callService.endCall(client, data.callId);
  }

  /** ---------------- HELPER EMITS ---------------- */
  public disconnectWithError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, errorResponse(null, message));
    client.disconnect(true);
    this.logger.warn(`Disconnect ${client.id}: ${message}`);
  }

  public emitError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, errorResponse(null, message));
    return errorResponse(null, message);
  }
}
