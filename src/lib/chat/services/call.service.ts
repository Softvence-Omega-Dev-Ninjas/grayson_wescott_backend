import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { ChatEventsEnum } from '../enum/chat-events.enum';
import {
  CallActionPayload,
  CallJoinPayload,
  InitiateCallPayload,
} from '../types/call-payloads';

@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /** Initiate a call */
  async handleCallInitiate(client: Socket, payload: InitiateCallPayload) {
    const call = await this.prisma.privateCall.create({
      data: {
        conversationId: payload.conversationId,
        initiatorId: client.data.userId,
        type: payload.type,
        status: 'INITIATED',
        participants: {
          create: payload.participantIds.map((userId) => ({
            userId,
            status: 'MISSED',
          })),
        },
      },
      include: { participants: true },
    });

    // Notify all participants
    payload.participantIds.forEach((uid) => {
      this.chatGateway.emitToUser(uid, ChatEventsEnum.CALL_INITIATE, call);
    });

    return call;
  }

  async handleCallAccept(client: Socket, payload: CallActionPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'JOINED', joinedAt: new Date() },
    });

    this.chatGateway.emitToUser(
      client.data.userId,
      ChatEventsEnum.CALL_ACCEPT,
      { callId: payload.callId },
    );
  }

  async handleCallReject(client: Socket, payload: CallActionPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'MISSED' },
    });

    this.chatGateway.emitToUser(
      client.data.userId,
      ChatEventsEnum.CALL_REJECT,
      { callId: payload.callId },
    );
  }

  async handleCallJoin(client: Socket, payload: CallJoinPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'JOINED', joinedAt: new Date() },
    });

    this.chatGateway.emitToUser(client.data.userId, ChatEventsEnum.CALL_JOIN, {
      callId: payload.callId,
    });
  }

  async handleCallLeave(client: Socket, payload: CallJoinPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'LEFT', leftAt: new Date() },
    });

    this.chatGateway.emitToUser(client.data.userId, ChatEventsEnum.CALL_LEAVE, {
      callId: payload.callId,
    });
  }

  async handleCallEnd(client: Socket, payload: CallActionPayload) {
    await this.prisma.privateCall.update({
      where: { id: payload.callId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    this.chatGateway.emitToUser(client.data.userId, ChatEventsEnum.CALL_END, {
      callId: payload.callId,
    });
  }
}
