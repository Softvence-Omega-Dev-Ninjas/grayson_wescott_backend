import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CallParticipantStatus, CallStatus } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { InitiateCallDto } from '../dto/call.dto';
import { ChatEventsEnum } from '../enum/chat-events.enum';

@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  // === INITIATE CALL ===
  @HandleError('Failed to initiate call', 'CallService')
  async initiateCall(
    client: Socket,
    data: InitiateCallDto,
  ): Promise<TResponse<any>> {
    const { conversationId, type } = data;

    const callerId = client.data.userId;
    if (!callerId) return this.chatGateway.emitError(client, 'Unauthorized');

    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conversation)
      return this.chatGateway.emitError(client, 'Conversation not found');

    const call = await this.prisma.privateCall.create({
      data: {
        conversationId,
        initiatorId: callerId,
        type,
        status: CallStatus.INITIATED,
        participants: {
          create: conversation.participants.map((p) => ({
            userId: p.userId!,
            status:
              p.userId === callerId
                ? CallParticipantStatus.JOINED
                : CallParticipantStatus.MISSED,
          })),
        },
      },
      include: { participants: true },
    });

    // Notify all participants
    this.emitCallEvent(
      conversation.participants.map((p) => ({ userId: p.userId! })),
      ChatEventsEnum.CALL_INCOMING,
      call,
    );

    return successResponse(call, 'Call initiated successfully');
  }

  // === ACCEPT CALL ===
  @HandleError('Failed to accept call', 'CallService')
  async acceptCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    const participant = call.participants.find((p) => p.userId === userId);
    if (participant) {
      await this.prisma.privateCallParticipant.update({
        where: { id: participant.id },
        data: { status: CallParticipantStatus.JOINED, joinedAt: new Date() },
      });
    } else {
      await this.prisma.privateCallParticipant.create({
        data: { callId, userId, status: CallParticipantStatus.JOINED },
      });
    }

    if (call.status === CallStatus.INITIATED) {
      await this.prisma.privateCall.update({
        where: { id: call.id },
        data: { status: CallStatus.ONGOING, startedAt: new Date() },
      });
    }

    this.emitCallEvent(call.participants, ChatEventsEnum.CALL_ACCEPT, {
      callId,
      userId,
    });

    return successResponse({ callId, userId }, 'Accepted call successfully');
  }

  // === REJECT CALL ===
  @HandleError('Failed to reject call', 'CallService')
  async rejectCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    await this.prisma.privateCallParticipant.updateMany({
      where: { callId, userId },
      data: { status: CallParticipantStatus.MISSED, leftAt: new Date() },
    });

    this.emitCallEvent(call.participants, ChatEventsEnum.CALL_REJECT, {
      callId,
      userId,
    });

    return successResponse({ callId, userId }, 'Rejected call successfully');
  }

  // === JOIN ONGOING CALL ===
  @HandleError('Failed to join call', 'CallService')
  async joinCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const participant = await this.prisma.privateCallParticipant.findFirst({
      where: { callId, userId },
    });

    if (participant) {
      await this.prisma.privateCallParticipant.update({
        where: { id: participant.id },
        data: { status: CallParticipantStatus.JOINED, joinedAt: new Date() },
      });
    } else {
      await this.prisma.privateCallParticipant.create({
        data: { callId, userId, status: CallParticipantStatus.JOINED },
      });
    }

    this.emitCallEvent([{ userId }], ChatEventsEnum.CALL_JOIN, {
      callId,
      userId,
    });

    return successResponse({ callId, userId }, 'Joined call successfully');
  }

  // === LEAVE CALL ===
  @HandleError('Failed to leave call', 'CallService')
  async leaveCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const participant = await this.prisma.privateCallParticipant.findFirst({
      where: { callId, userId },
    });
    if (!participant)
      return this.chatGateway.emitError(client, 'Participant not found');

    await this.prisma.privateCallParticipant.update({
      where: { id: participant.id },
      data: { status: CallParticipantStatus.LEFT, leftAt: new Date() },
    });

    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });

    const activeParticipants = call?.participants.filter(
      (p) => p.status === CallParticipantStatus.JOINED,
    );

    if (!activeParticipants?.length) {
      await this.prisma.privateCall.update({
        where: { id: callId },
        data: { status: CallStatus.ENDED, endedAt: new Date() },
      });
      this.emitCallEvent(call?.participants || [], ChatEventsEnum.CALL_END, {
        callId,
      });
    } else {
      this.emitCallEvent(call?.participants || [], ChatEventsEnum.CALL_LEAVE, {
        callId,
        userId,
      });
    }

    return successResponse({ callId, userId }, 'Left call successfully');
  }

  // === END CALL (by initiator / server cleanup) ===
  @HandleError('Failed to end call', 'CallService')
  async endCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const call = await this.prisma.privateCall.update({
      where: { id: callId },
      data: { status: CallStatus.ENDED, endedAt: new Date() },
      include: { participants: true },
    });

    this.emitCallEvent(call.participants, ChatEventsEnum.CALL_END, { callId });

    return successResponse({ callId }, 'Call ended successfully');
  }

  // === MARK MISSED CALL ===
  @HandleError('Failed to mark missed call', 'CallService')
  async markMissedCall(callId: string): Promise<TResponse<any>> {
    const call = await this.prisma.privateCall.update({
      where: { id: callId },
      data: { status: CallStatus.MISSED, endedAt: new Date() },
      include: { participants: true },
    });

    await this.prisma.privateCallParticipant.updateMany({
      where: { callId },
      data: { status: CallParticipantStatus.MISSED },
    });

    this.emitCallEvent(call.participants, ChatEventsEnum.CALL_MISSED, {
      callId,
    });

    return successResponse({ callId }, 'Call marked as missed');
  }

  /** ---------------- Helper to emit call events ---------------- */
  private emitCallEvent(
    participants: { userId: string }[],
    event: ChatEventsEnum,
    payload: any,
  ) {
    participants.forEach((p) => {
      if (p.userId) {
        this.chatGateway.server
          .to(p.userId)
          .emit(event, successResponse(payload));
      }
    });
  }
}
