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

  /**
   * callSocketMap stores a mapping: callId -> ( userId -> socketId )
   * We populate this when a participant initiates, accepts, or joins a call.
   * This lets us forward SDP/ICE to the exact socket that joined the call.
   */
  private callSocketMap = new Map<string, Map<string, string>>();

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

    // initialize preferred-socket map for this call, prefer initiator socket
    const map = new Map<string, string>();
    map.set(callerId, client.id);
    this.callSocketMap.set(call.id, map);

    // Notify all participants (targeted emit to their active socket)
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

    // remember which socket accepted (prefer this socket for routing)
    this.ensureCallSocketEntry(callId).set(userId, client.id);
    this.logger.debug(
      `Recorded socket mapping for call ${callId} user ${userId} => ${client.id}`,
    );

    // Clear ring timeout because someone joined
    this.clearRingTimeout(callId);

    // Emit CALL_ACCEPT (inform all participants who joined)
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

    // record the socket that joined for deterministic routing
    this.ensureCallSocketEntry(callId).set(userId, client.id);
    this.logger.debug(
      `Recorded join mapping for call ${callId} user ${userId} => ${client.id}`,
    );

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

    // Remove socket mapping for this participant for this call
    const map = this.callSocketMap.get(callId);
    if (map) {
      map.delete(userId);
    }

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

      // cleanup mapping
      this.callSocketMap.delete(callId);
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

    // cleanup mapping
    this.callSocketMap.delete(callId);
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

    // cleanup mapping
    this.callSocketMap.delete(callId);
    return successResponse({ callId }, 'Call marked as missed');
  }

  /** ---------------- WebRTC signalling forwarding helpers ---------------- */

  /*
    These methods validate the caller is a participant of the call,
    then forward the payload to a single socket chosen like this:
      1) If payload.to is provided and maps to an active socket, use it.
      2) Else: if we have a recorded socket for (callId, userId) use it.
      3) Else: use the first active socket found via ChatGateway.getActiveSocketIdsForUser(userId).
  */

  private ensureCallSocketEntry(callId: string) {
    if (!this.callSocketMap.has(callId)) {
      this.callSocketMap.set(callId, new Map<string, string>());
    }
    return this.callSocketMap.get(callId)!;
  }

  private findTargetSocketForRecipient(
    callId: string,
    recipientUserId: string,
    payloadTo?: string, // optional value from client payload.to (userId or socketId)
    excludeSocketId?: string,
  ): string | null {
    // If payloadTo looks like a socket id and exists, prefer it
    if (payloadTo && typeof payloadTo === 'string') {
      // if payloadTo is actual socket id (exists on server), pick it
      const activeForTo = this.chatGateway.getActiveSocketIdsForUser(
        recipientUserId,
        excludeSocketId,
      );
      // if payloadTo matches one of the active socket ids for recipient, prefer it
      if (activeForTo.includes(payloadTo)) {
        this.logger.debug(
          `Using payload.to socket ${payloadTo} for recipient ${recipientUserId}`,
        );
        return payloadTo;
      }
      // if payloadTo looks like a userId equal to recipient, we'll fallback below
    }

    // Prefer the recorded socket for this call & user
    const map = this.callSocketMap.get(callId);
    if (map) {
      const recorded = map.get(recipientUserId);
      if (recorded && recorded !== excludeSocketId) {
        this.logger.debug(
          `Using recorded socket ${recorded} for call ${callId} user ${recipientUserId}`,
        );
        return recorded;
      }
    }

    // Fallback: first active socket for the user (exclude sender)
    const active = this.chatGateway.getActiveSocketIdsForUser(
      recipientUserId,
      excludeSocketId,
    );
    if (active.length > 0) {
      this.logger.debug(
        `Using first active socket ${active[0]} for recipient ${recipientUserId}`,
      );
      return active[0];
    }

    // nothing found
    this.logger.warn(
      `No active socket found for recipient ${recipientUserId} (call ${callId})`,
    );
    return null;
  }

  @HandleError('Failed to forward offer', 'CallService')
  async forwardOffer(
    client: Socket,
    payload: { callId: string; sdp: string; to?: string; from?: string },
  ): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    // only forward to other participants
    for (const p of call.participants.filter((p) => p.userId !== userId)) {
      const targetSockId = this.findTargetSocketForRecipient(
        call.id,
        p.userId!,
        payload.to,
        client.id,
      );
      if (!targetSockId) {
        this.logger.warn(
          `Skipping OFFER forward: no target socket for user ${p.userId}`,
        );
        continue;
      }

      this.logger.log(
        `Forwarding OFFER from ${userId} -> ${p.userId} (socket ${targetSockId})`,
      );
      this.chatGateway.emitToSocketId(
        targetSockId,
        EventsEnum.RTC_OFFER,
        successResponse({
          callId: call.id,
          sdp: payload.sdp,
          from: userId,
        }),
      );
    }

    return successResponse(payload, 'Offer forwarded');
  }

  @HandleError('Failed to forward answer', 'CallService')
  async forwardAnswer(
    client: Socket,
    payload: { callId: string; sdp: string; to?: string; from?: string },
  ): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    for (const p of call.participants.filter((p) => p.userId !== userId)) {
      const targetSockId = this.findTargetSocketForRecipient(
        call.id,
        p.userId!,
        payload.to,
        client.id,
      );
      if (!targetSockId) {
        this.logger.warn(
          `Skipping ANSWER forward: no target socket for user ${p.userId}`,
        );
        continue;
      }

      this.logger.log(
        `Forwarding ANSWER from ${userId} -> ${p.userId} (socket ${targetSockId})`,
      );
      this.chatGateway.emitToSocketId(
        targetSockId,
        EventsEnum.RTC_ANSWER,
        successResponse({
          callId: call.id,
          sdp: payload.sdp,
          from: userId,
        }),
      );
    }

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
      to?: string;
      from?: string;
    },
  ): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    for (const p of call.participants.filter((p) => p.userId !== userId)) {
      const targetSockId = this.findTargetSocketForRecipient(
        call.id,
        p.userId!,
        payload.to,
        client.id,
      );
      if (!targetSockId) {
        this.logger.warn(
          `Skipping CANDIDATE forward: no target socket for user ${p.userId}`,
        );
        continue;
      }

      this.logger.debug(
        `Forwarding CANDIDATE from ${userId} -> ${p.userId} (socket ${targetSockId})`,
      );
      this.chatGateway.emitToSocketId(
        targetSockId,
        EventsEnum.RTC_ICE_CANDIDATE,
        successResponse({
          callId: call.id,
          candidate: payload.candidate,
          sdpMid: payload.sdpMid,
          sdpMLineIndex: payload.sdpMLineIndex,
          from: userId,
        }),
      );
    }

    return successResponse(payload, 'Candidate forwarded');
  }

  /** ---------------- Helper to emit call events ---------------- */
  private emitCallEvent(
    participants: { userId: string }[],
    event: EventsEnum,
    payload: any,
  ) {
    participants.forEach((p) => {
      if (!p.userId) return;

      const targetSockId = this.findTargetSocketForRecipient(
        // try to find a socket mapped to this call; if not, fallback to any active socket
        payload?.id || payload?.callId || 'unknown-call',
        p.userId,
      );
      if (!targetSockId) {
        this.logger.debug(
          `emitCallEvent: no active socket for ${p.userId}, skipping event ${event}`,
        );
        return;
      }

      this.logger.debug(
        `emitCallEvent: sending ${event} to ${p.userId} (socket ${targetSockId})`,
      );
      this.chatGateway.emitToSocketId(
        targetSockId,
        event,
        successResponse(payload),
      );
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
