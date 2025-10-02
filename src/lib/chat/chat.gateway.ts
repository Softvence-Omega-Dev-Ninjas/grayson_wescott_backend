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
import {
  errorResponse,
  successResponse,
} from '@project/common/utils/response.util';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
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
import {
  RTCAnswerDto,
  RTCIceCandidateDto,
  RTCOfferDto,
} from './dto/webrtc.dto';
import { ChatEventsEnum } from './enum/chat-events.enum';
import { CallService } from './services/call.service';
import { ClientConversationService } from './services/client-conversation.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { SingleConversationService } from './services/single-conversation.service';
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
  private readonly clients = new Map<string, Set<Socket>>();

  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly singleConversationService: SingleConversationService,
    private readonly clientConversationService: ClientConversationService,
    private readonly callService: CallService,
    private readonly webRTCService: WebRTCService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log('Socket.IO server initialized', server.adapter?.name ?? '');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        return this.disconnectWithError(client, 'Missing token');
      }

      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      });

      if (!payload.sub) {
        return this.disconnectWithError(client, 'Invalid token payload');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          avatarUrl: true,
        },
      });

      if (!user) return this.disconnectWithError(client, 'User not found');

      client.data.userId = user.id;
      client.data.user = payload;
      client.join(user.id);

      this.subscribeClient(user.id, client);

      this.logger.log(`User connected: ${user.id} (socket ${client.id})`);
      client.emit(ChatEventsEnum.SUCCESS, successResponse(user));
    } catch (err: any) {
      this.disconnectWithError(client, err?.message ?? 'Auth failed');
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.unsubscribeClient(userId, client);
      client.leave(userId);
      this.logger.log(`Client disconnected: ${userId}`);
    } else {
      this.logger.log(
        `Client disconnected: unknown user (socket ${client.id})`,
      );
    }
  }

  /** ---------------- CLIENT HELPERS ---------------- */
  private subscribeClient(userId: string, client: Socket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(client);
    this.logger.debug(`Subscribed client to user ${userId}`);
  }

  private unsubscribeClient(userId: string, client: Socket) {
    const set = this.clients.get(userId);
    if (!set) return;

    set.delete(client);
    this.logger.debug(`Unsubscribed client from user ${userId}`);
    if (set.size === 0) {
      this.clients.delete(userId);
      this.logger.debug(`Removed empty client set for user ${userId}`);
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    const authHeader =
      (client.handshake.headers.authorization as string) ||
      (client.handshake.auth?.token as string);

    if (!authHeader) return null;
    return authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;
  }

  /** ---------------- ERROR HELPERS ---------------- */
  public disconnectWithError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, errorResponse(null, message));
    client.disconnect(true);
    this.logger.warn(`Disconnect ${client.id}: ${message}`);
  }

  public emitError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, errorResponse(null, message));
    return errorResponse(null, message);
  }

  /** ---------------- MESSAGE EVENTS ---------------- */
  @SubscribeMessage(ChatEventsEnum.SEND_MESSAGE_CLIENT)
  async onSendMessageClient(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ClientMessageDto,
  ) {
    await this.messageService.sendMessageFromClient(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.SEND_MESSAGE_ADMIN)
  async onSendMessageAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AdminMessageDto,
  ) {
    await this.messageService.sendMessageFromAdmin(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.UPDATE_MESSAGE_STATUS)
  async onMessageStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageDeliveryStatusDto,
  ) {
    await this.messageService.messageStatusUpdate(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.MARK_MESSAGE_READ)
  async onMarkMessagesAsRead(@MessageBody() payload: MarkReadDto) {
    await this.messageService.markMessagesAsRead(payload);
  }

  /** ---------------- CONVERSATION EVENTS ---------------- **/
  @SubscribeMessage(ChatEventsEnum.LOAD_CONVERSATION_LIST)
  async onLoadConversationsByAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadConversationsDto,
  ) {
    await this.conversationService.handleLoadConversationsByAdmin(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_SINGLE_CONVERSATION)
  async onLoadSingleConversationByAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadSingleConversationDto,
  ) {
    await this.singleConversationService.handleLoadSingleConversationByAdmin(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.INIT_CONVERSATION_WITH_CLIENT)
  async onInitConversationWithClient(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: InitConversationWithClientDto,
  ) {
    await this.singleConversationService.handleInitConversationWithClient(
      client,
      payload,
    );
  }

  @SubscribeMessage(ChatEventsEnum.LOAD_CLIENT_CONVERSATION)
  async onLoadClientConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PaginationDto,
  ) {
    await this.clientConversationService.handleLoadClientConversation(
      client,
      payload,
    );
  }

  /** ---------------- CALL EVENTS ---------------- **/
  @SubscribeMessage(ChatEventsEnum.CALL_INITIATE)
  async onCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: InitiateCallDto,
  ) {
    await this.callService.initiateCall(client, data);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_ACCEPT)
  async onCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    await this.callService.acceptCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_REJECT)
  async onCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    await this.callService.rejectCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_JOIN)
  async onCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    await this.callService.joinCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_LEAVE)
  async onCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    await this.callService.leaveCall(client, data.callId);
  }

  @SubscribeMessage(ChatEventsEnum.CALL_END)
  async onCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallActionDto,
  ) {
    await this.callService.endCall(client, data.callId);
  }

  /** ---------------- WEBRTC EVENTS ---------------- */
  @SubscribeMessage(ChatEventsEnum.RTC_OFFER)
  async onRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RTCOfferDto,
  ) {
    await this.webRTCService.handleOffer(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.RTC_ANSWER)
  async onRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RTCAnswerDto,
  ) {
    await this.webRTCService.handleAnswer(client, payload);
  }

  @SubscribeMessage(ChatEventsEnum.RTC_ICE_CANDIDATE)
  async onRTCIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RTCIceCandidateDto,
  ) {
    await this.webRTCService.handleCandidate(client, payload);
  }
}
