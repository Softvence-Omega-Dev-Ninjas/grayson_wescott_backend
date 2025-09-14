import { Injectable } from '@nestjs/common';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Server, Socket } from 'socket.io';
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
    private readonly server: Server,
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
      this.server.to(uid).emit(ChatEventsEnum.CALL_INCOMING, call);
    });

    return call;
  }

  async handleCallAccept(client: Socket, payload: CallActionPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'JOINED', joinedAt: new Date() },
    });

    this.server
      .to(payload.callId)
      .emit(ChatEventsEnum.CALL_ACCEPT, { userId: client.data.userId });
  }

  async handleCallReject(client: Socket, payload: CallActionPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'MISSED' },
    });

    this.server
      .to(payload.callId)
      .emit(ChatEventsEnum.CALL_REJECT, { userId: client.data.userId });
  }

  async handleCallJoin(client: Socket, payload: CallJoinPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'JOINED', joinedAt: new Date() },
    });

    this.server
      .to(payload.callId)
      .emit(ChatEventsEnum.CALL_JOIN, { userId: client.data.userId });
  }

  async handleCallLeave(client: Socket, payload: CallJoinPayload) {
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId: payload.callId, userId: client.data.userId },
      data: { status: 'LEFT', leftAt: new Date() },
    });

    this.server
      .to(payload.callId)
      .emit(ChatEventsEnum.CALL_LEAVE, { userId: client.data.userId });
  }

  async handleCallEnd(client: Socket, payload: CallActionPayload) {
    await this.prisma.privateCall.update({
      where: { id: payload.callId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    this.server
      .to(payload.callId)
      .emit(ChatEventsEnum.CALL_END, { callId: payload.callId });
  }
}
