import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CallParticipantStatus, CallStatus, CallType } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { ChatEventsEnum } from '../enum/chat-events.enum';

@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to initiate call', 'CallService')
  async initiateCall(
    client: Socket,
    conversationId: string,
    type: CallType,
  ): Promise<TResponse<any>> {
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
      conversation?.participants.map((p) => ({ userId: p.userId! })) || [],
      ChatEventsEnum.CALL_INCOMING,
      call,
    );

    return successResponse(call, 'Call initiated successfully');
  }

  @HandleError('Failed to join call', 'CallService')
  async acceptCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    // Update participant status
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

    // Update call status if needed
    if (call.status === CallStatus.INITIATED) {
      await this.prisma.privateCall.update({
        where: { id: call.id },
        data: { status: CallStatus.ONGOING, startedAt: new Date() },
      });
    }

    // Notify all participants
    this.emitCallEvent(call.participants, ChatEventsEnum.CALL_JOIN, {
      callId,
      userId,
    });

    return successResponse({ callId, userId }, 'Joined call successfully');
  }

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

    // If no participants left → end the call
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
      // Notify participants who left
      this.emitCallEvent(call?.participants || [], ChatEventsEnum.CALL_LEAVE, {
        callId,
        userId,
      });
    }

    return successResponse({ callId, userId }, 'Left call successfully');
  }

  /** ---------------- Helper to emit call events to all participants ---------------- */
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
