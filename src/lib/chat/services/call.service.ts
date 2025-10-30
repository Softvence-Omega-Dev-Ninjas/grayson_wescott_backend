import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CallParticipantStatus,
  CallStatus,
  CallType as PrismaCallType,
} from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { EventsEnum } from '../../../common/enum/events.enum';
import { ChatGateway } from '../chat.gateway';
import { InitiateCallDto } from '../dto/call.dto';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  /**
   * In-memory map to track ring timeout per call.
   * If your server restarts this will be lost — fine for short-lived ring timers.
   */
  private ringTimeouts = new Map<string, NodeJS.Timeout>();

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
        type: type as PrismaCallType,
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
      EventsEnum.CALL_INCOMING,
      call,
    );

    // Start ring timeout: if nobody joins within 30s, mark missed
    this.setRingTimeout(call.id, 30_000);

    return successResponse(call, 'Call initiated successfully');
  }

  // === ACCEPT CALL ===
  @HandleError('Failed to accept call', 'CallService')
  async acceptCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    // transactionally update participant + possibly call status
    const updated = await this.prisma.$transaction(async (prisma) => {
      // fetch call + participants for validation
      const call = await prisma.privateCall.findUnique({
        where: { id: callId },
        include: { participants: true },
      });
      if (!call) throw new Error('Call not found');

      const participant = call.participants.find((p) => p.userId === userId);
      if (participant) {
        await prisma.privateCallParticipant.update({
          where: { id: participant.id },
          data: { status: CallParticipantStatus.JOINED, joinedAt: new Date() },
        });
      } else {
        await prisma.privateCallParticipant.create({
          data: { callId, userId, status: CallParticipantStatus.JOINED },
        });
      }

      // reload participants
      const refreshed = await prisma.privateCall.findUnique({
        where: { id: callId },
        include: { participants: true },
      });

      // If call still INITIATED, move to ONGOING and set startedAt
      if (refreshed && refreshed.status === CallStatus.INITIATED) {
        await prisma.privateCall.update({
          where: { id: callId },
          data: { status: CallStatus.ONGOING, startedAt: new Date() },
        });
      }

      // return latest call row with participants
      const latest = await prisma.privateCall.findUnique({
        where: { id: callId },
        include: { participants: true },
      });
      return latest!;
    });

    // Clear ring timeout because someone joined
    this.clearRingTimeout(callId);

    // Emit CALL_ACCEPT (inform all participants who joined)
    this.emitCallEvent(updated.participants || [], EventsEnum.CALL_ACCEPT, {
      callId,
      userId,
      call: updated,
    });

    // Also emit an informative event so clients know the call is now ONGOING and can start signaling.
    // Clients should react to CALL_ACCEPT payload containing call.status === 'ONGOING' to begin WebRTC.
    this.emitCallEvent(updated.participants || [], EventsEnum.CALL_ACCEPT, {
      callId,
      userId,
      call: updated,
    });

    return successResponse(
      { callId, userId, call: updated },
      'Accepted call successfully',
    );
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

    // If caller was the only joined participant and everyone else missed/rejected, mark missed/end
    const participants = await this.prisma.privateCallParticipant.findMany({
      where: { callId },
    });
    const joinedCount = participants.filter(
      (p) => p.status === CallParticipantStatus.JOINED,
    ).length;
    if (!joinedCount) {
      // mark call missed
      await this.prisma.privateCall.update({
        where: { id: callId },
        data: { status: CallStatus.MISSED, endedAt: new Date() },
      });
      this.emitCallEvent(call.participants, EventsEnum.CALL_MISSED, { callId });
      this.clearRingTimeout(callId);
    } else {
      // emit reject to remaining participants
      this.emitCallEvent(call.participants, EventsEnum.CALL_REJECT, {
        callId,
        userId,
      });
    }

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

    // Clear ring timeout on join
    this.clearRingTimeout(callId);

    // Emit join
    this.emitCallEvent([{ userId }], EventsEnum.CALL_JOIN, {
      callId,
      userId,
    });

    // Ensure call status becomes ONGOING
    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (call && call.status === CallStatus.INITIATED) {
      await this.prisma.privateCall.update({
        where: { id: callId },
        data: { status: CallStatus.ONGOING, startedAt: new Date() },
      });

      const updated = await this.prisma.privateCall.findUnique({
        where: { id: callId },
        include: { participants: true },
      });

      // emit accept-like payload so clients know call is ongoing and can begin WebRTC
      this.emitCallEvent(updated?.participants || [], EventsEnum.CALL_ACCEPT, {
        callId,
        userId,
        call: updated,
      });
    }

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
      this.clearRingTimeout(callId);
      this.emitCallEvent(call?.participants || [], EventsEnum.CALL_END, {
        callId,
      });
    } else {
      this.emitCallEvent(call?.participants || [], EventsEnum.CALL_LEAVE, {
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

    this.clearRingTimeout(callId);
    this.emitCallEvent(call.participants, EventsEnum.CALL_END, { callId });

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

    this.clearRingTimeout(callId);
    this.emitCallEvent(call.participants, EventsEnum.CALL_MISSED, {
      callId,
    });

    return successResponse({ callId }, 'Call marked as missed');
  }

  /** ---------------- WebRTC signalling forwarding helpers ---------------- */

  /*
    These methods simply validate the caller is a participant of the call,
    then forward the payload to all OTHER participants using the same
    EventsEnum names your frontend expects:
      - EventsEnum.RTC_OFFER
      - EventsEnum.RTC_ANSWER
      - EventsEnum.RTC_ICE_CANDIDATE
  */

  @HandleError('Failed to forward offer', 'CallService')
  async forwardOffer(
    client: Socket,
    payload: { callId: string; sdp: string },
  ): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    // only forward to other participants
    call.participants
      .filter((p) => p.userId !== userId)
      .forEach((p) =>
        this.chatGateway.server.to(p.userId).emit(
          EventsEnum.RTC_OFFER,
          successResponse({
            callId: call.id,
            sdp: payload.sdp,
            from: userId,
          }),
        ),
      );

    return successResponse(payload, 'Offer forwarded');
  }

  @HandleError('Failed to forward answer', 'CallService')
  async forwardAnswer(
    client: Socket,
    payload: { callId: string; sdp: string },
  ): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    call.participants
      .filter((p) => p.userId !== userId)
      .forEach((p) =>
        this.chatGateway.server.to(p.userId).emit(
          EventsEnum.RTC_ANSWER,
          successResponse({
            callId: call.id,
            sdp: payload.sdp,
            from: userId,
          }),
        ),
      );

    return successResponse(payload, 'Answer forwarded');
  }

  @HandleError('Failed to forward ICE candidate', 'CallService')
  async forwardCandidate(
    client: Socket,
    payload: {
      callId: string;
      candidate: string;
      sdpMid: string;
      sdpMLineIndex: string;
    },
  ): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    call.participants
      .filter((p) => p.userId !== userId)
      .forEach((p) =>
        this.chatGateway.server.to(p.userId).emit(
          EventsEnum.RTC_ICE_CANDIDATE,
          successResponse({
            callId: call.id,
            candidate: payload.candidate,
            sdpMid: payload.sdpMid,
            sdpMLineIndex: payload.sdpMLineIndex,
            from: userId,
          }),
        ),
      );

    return successResponse(payload, 'Candidate forwarded');
  }

  /** ---------------- Helper to emit call events ---------------- */
  private emitCallEvent(
    participants: { userId: string }[],
    event: EventsEnum,
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

  /** ---------------- Ring timeout helpers ---------------- */
  private setRingTimeout(callId: string, ms = 30_000) {
    // clear existing if any
    this.clearRingTimeout(callId);

    const t = setTimeout(async () => {
      try {
        this.logger.log(`Call ${callId} ring timeout reached, marking missed`);
        await this.markMissedCall(callId);
      } catch (err) {
        this.logger.error('Failed to mark missed call', err as any);
      } finally {
        this.clearRingTimeout(callId);
      }
    }, ms);

    this.ringTimeouts.set(callId, t);
  }

  private clearRingTimeout(callId: string) {
    const t = this.ringTimeouts.get(callId);
    if (t) {
      clearTimeout(t);
      this.ringTimeouts.delete(callId);
    }
  }
}
