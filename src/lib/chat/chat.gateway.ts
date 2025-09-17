import { Injectable } from '@nestjs/common';
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
import { Server, Socket } from 'socket.io';
import { AppGateway } from '../gateway/app.gateway';
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
  extends AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly singleConversationService: SingleConversationService,
    private readonly clientConversationService: ClientConversationService,
    private readonly callService: CallService,
    private readonly webRTCService: WebRTCService,
    configService: ConfigService,
    prisma: PrismaService,
    jwtService: JwtService,
  ) {
    super(configService, prisma, jwtService);
  }

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.init(server);
  }

  handleConnection(client: Socket) {
    this.connection(client);
  }

  handleDisconnect(client: Socket) {
    this.disconnect(client);
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
