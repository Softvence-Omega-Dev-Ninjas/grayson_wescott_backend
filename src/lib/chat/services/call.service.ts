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
import {
  RTCAnswerDto,
  RTCIceCandidateDto,
  RTCOfferDto,
} from '../dto/webrtc.dto';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  // callId -> ( userId -> socketId )
  private callSocketMap = new Map<string, Map<string, string>>();

  // short-lived ring timers
  private ringTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /** -------------------- Initiate (ADMIN -> USER) -------------------- */
  @HandleError('Failed to initiate call', 'CallService')
  async initiateCall(
    client: Socket,
    dto: InitiateCallDto,
  ): Promise<TResponse<any>> {
    const callerId = client.data.userId;
    if (!callerId) return this.chatGateway.emitError(client, 'Unauthorized');

    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: dto.conversationId },
      include: { participants: true },
    });
    if (!conversation)
      return this.chatGateway.emitError(client, 'Conversation not found');

    // caller must be an ADMIN_GROUP participant
    const callerParticipant = conversation.participants.find(
      (p) => p.userId === callerId && p.type === 'ADMIN_GROUP',
    );
    if (!callerParticipant)
      return this.chatGateway.emitError(
        client,
        'Only admins may initiate calls',
      );

    // pick the single user participant (one-to-one)
    const userParticipant = conversation.participants.find(
      (p) => p.type === 'USER' && p.userId,
    );
    if (!userParticipant)
      return this.chatGateway.emitError(
        client,
        'No user in conversation to call',
      );

    // create call with two participant records: initiator joined, target missed
    const call = await this.prisma.privateCall.create({
      data: {
        conversationId: dto.conversationId,
        initiatorId: callerId,
        type: dto.type as PrismaCallType,
        status: CallStatus.INITIATED,
        participants: {
          create: [
            {
              userId: callerId,
              status: CallParticipantStatus.JOINED,
            },
            {
              userId: userParticipant.userId!,
              status: CallParticipantStatus.MISSED,
            },
          ],
        },
      },
      include: { participants: true },
    });

    // store socket mapping preferring initiator socket
    const map = new Map<string, string>();
    map.set(callerId, client.id);
    this.callSocketMap.set(call.id, map);

    // notify the target user (single recipient)
    const targetSocket = this.findTargetSocketForRecipient(
      call.id,
      userParticipant.userId!,
    );
    if (targetSocket) {
      this.chatGateway.emitToSocketId(
        targetSocket,
        EventsEnum.CALL_INCOMING,
        successResponse({ call, from: callerId }),
      );
    }

    // start ring timeout (mark missed if nobody joins)
    this.setRingTimeout(call.id, 30_000);

    return successResponse(call, 'Call initiated');
  }

  /** -------------------- Accept (USER accepts) -------------------- */
  @HandleError('Failed to accept call', 'CallService')
  async acceptCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    // validate call exists and user is a participant
    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    // mark participant as JOINED (create if missing)
    const existing = call.participants.find((p) => p.userId === userId);
    if (existing) {
      await this.prisma.privateCallParticipant.update({
        where: { id: existing.id },
        data: { status: CallParticipantStatus.JOINED, joinedAt: new Date() },
      });
    } else {
      await this.prisma.privateCallParticipant.create({
        data: {
          callId,
          userId,
          status: CallParticipantStatus.JOINED,
          joinedAt: new Date(),
        },
      });
    }

    // move call -> ONGOING if still INITIATED
    if (call.status === CallStatus.INITIATED) {
      await this.prisma.privateCall.update({
        where: { id: callId },
        data: { status: CallStatus.ONGOING, startedAt: new Date() },
      });
    }

    // record socket mapping for deterministic routing
    this.ensureCallSocketEntry(callId).set(userId, client.id);

    // clear ring timeout
    this.clearRingTimeout(callId);

    // notify initiator (admin) that user accepted
    const initiator = call.participants.find((p) => p.userId !== userId);
    if (initiator?.userId) {
      const targetSock = this.findTargetSocketForRecipient(
        call.id,
        initiator.userId,
      );
      if (targetSock) {
        this.chatGateway.emitToSocketId(
          targetSock,
          EventsEnum.CALL_ACCEPT,
          successResponse({ callId, userId }),
        );
      }
    }

    return successResponse({ callId, userId }, 'Call accepted');
  }

  /** -------------------- Reject (USER rejects) -------------------- */
  @HandleError('Failed to reject call', 'CallService')
  async rejectCall(client: Socket, callId: string): Promise<TResponse<any>> {
    const userId = client.data.userId;
    if (!userId) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    // mark this participant missed/rejected
    await this.prisma.privateCallParticipant.updateMany({
      where: { callId, userId },
      data: { status: CallParticipantStatus.MISSED, leftAt: new Date() },
    });

    // mark call missed and notify initiator
    await this.prisma.privateCall.update({
      where: { id: callId },
      data: { status: CallStatus.MISSED, endedAt: new Date() },
    });

    this.clearRingTimeout(callId);
    this.callSocketMap.delete(callId);

    const initiator = call.participants.find((p) => p.userId !== userId);
    if (initiator?.userId) {
      const targetSock = this.findTargetSocketForRecipient(
        call.id,
        initiator.userId,
      );
      if (targetSock) {
        this.chatGateway.emitToSocketId(
          targetSock,
          EventsEnum.CALL_MISSED,
          successResponse({ callId, by: userId }),
        );
      }
    }

    return successResponse({ callId, userId }, 'Call rejected');
  }

  /** -------------------- End call (either side) -------------------- */
  @HandleError('Failed to end call', 'CallService')
  async endCall(client: Socket, callId: string): Promise<TResponse<any>> {
    // mark ended and notify both sides (if present)
    const call = await this.prisma.privateCall.update({
      where: { id: callId },
      data: { status: CallStatus.ENDED, endedAt: new Date() },
      include: { participants: true },
    });

    this.clearRingTimeout(callId);

    // notify remaining participants
    for (const p of call.participants) {
      if (!p.userId) continue;
      const sock = this.findTargetSocketForRecipient(call.id, p.userId);
      if (sock) {
        this.chatGateway.emitToSocketId(
          sock,
          EventsEnum.CALL_END,
          successResponse({ callId }),
        );
      }
    }

    this.callSocketMap.delete(callId);
    return successResponse({ callId }, 'Call ended');
  }

  /** -------------------- Signalling forwards (simplified) -------------------- */
  @HandleError('Failed to forward offer', 'CallService')
  async forwardOffer(
    client: Socket,
    payload: RTCOfferDto,
  ): Promise<TResponse<any>> {
    const from = client.data.userId;
    if (!from) return this.chatGateway.emitError(client, 'Unauthorized');

    // forward only to the other party (one-to-one)
    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    const other = call.participants.find((p) => p.userId !== from);
    if (!other?.userId)
      return this.chatGateway.emitError(client, 'Recipient not found');

    const target = this.findTargetSocketForRecipient(
      call.id,
      other.userId,
      payload.to,
      client.id,
    );
    if (!target)
      return this.chatGateway.emitError(client, 'Recipient not available');

    this.chatGateway.emitToSocketId(
      target,
      EventsEnum.RTC_OFFER,
      successResponse({ callId: call.id, sdp: payload.sdp, from }),
    );

    // record mapping prefer sender's socket for call
    this.ensureCallSocketEntry(call.id).set(from, client.id);
    return successResponse(payload, 'Offer forwarded');
  }

  @HandleError('Failed to forward answer', 'CallService')
  async forwardAnswer(
    client: Socket,
    payload: RTCAnswerDto,
  ): Promise<TResponse<any>> {
    const from = client.data.userId;
    if (!from) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    const other = call.participants.find((p) => p.userId !== from);
    if (!other?.userId)
      return this.chatGateway.emitError(client, 'Recipient not found');

    const target = this.findTargetSocketForRecipient(
      call.id,
      other.userId,
      payload.to,
      client.id,
    );
    if (!target)
      return this.chatGateway.emitError(client, 'Recipient not available');

    this.chatGateway.emitToSocketId(
      target,
      EventsEnum.RTC_ANSWER,
      successResponse({ callId: call.id, sdp: payload.sdp, from }),
    );
    this.ensureCallSocketEntry(call.id).set(from, client.id);
    return successResponse(payload, 'Answer forwarded');
  }

  @HandleError('Failed to forward candidate', 'CallService')
  async forwardCandidate(
    client: Socket,
    payload: RTCIceCandidateDto,
  ): Promise<TResponse<any>> {
    const from = client.data.userId;
    if (!from) return this.chatGateway.emitError(client, 'Unauthorized');

    const call = await this.prisma.privateCall.findUnique({
      where: { id: payload.callId },
      include: { participants: true },
    });
    if (!call) return this.chatGateway.emitError(client, 'Call not found');

    const other = call.participants.find((p) => p.userId !== from);
    if (!other?.userId)
      return this.chatGateway.emitError(client, 'Recipient not found');

    const target = this.findTargetSocketForRecipient(
      call.id,
      other.userId,
      payload.to,
      client.id,
    );
    if (!target)
      return this.chatGateway.emitError(client, 'Recipient not available');

    this.chatGateway.emitToSocketId(
      target,
      EventsEnum.RTC_ICE_CANDIDATE,
      successResponse({
        callId: call.id,
        candidate: payload.candidate,
        sdpMid: payload.sdpMid,
        sdpMLineIndex: payload.sdpMLineIndex,
        from,
      }),
    );
    this.ensureCallSocketEntry(call.id).set(from, client.id);
    return successResponse(payload, 'Candidate forwarded');
  }

  /** -------------------- Helpers -------------------- */
  private ensureCallSocketEntry(callId: string) {
    if (!this.callSocketMap.has(callId))
      this.callSocketMap.set(callId, new Map());
    return this.callSocketMap.get(callId)!;
  }

  private findTargetSocketForRecipient(
    callId: string,
    recipientUserId: string,
    // allow client to hint socket/userId; prefer recorded socket then active sockets
    payloadTo?: string,
    excludeSocketId?: string,
  ): string | null {
    // prefer explicit socket id if it matches active sockets
    if (payloadTo && typeof payloadTo === 'string') {
      const active = this.chatGateway.getActiveSocketIdsForUser(
        recipientUserId,
        excludeSocketId,
      );
      if (active.includes(payloadTo)) return payloadTo;
    }

    // prefer recorded socket for this call
    const map = this.callSocketMap.get(callId);
    if (map) {
      const recorded = map.get(recipientUserId);
      if (recorded && recorded !== excludeSocketId) return recorded;
    }

    // fallback to first active socket for user
    const active = this.chatGateway.getActiveSocketIdsForUser(
      recipientUserId,
      excludeSocketId,
    );
    if (active.length) return active[0];

    return null;
  }

  private setRingTimeout(callId: string, ms = 30_000) {
    this.clearRingTimeout(callId);
    const t = setTimeout(async () => {
      try {
        this.logger.log(`Call ${callId} ring timeout -> marking missed`);
        await this.prisma.privateCall.update({
          where: { id: callId },
          data: { status: CallStatus.MISSED, endedAt: new Date() },
        });
        this.callSocketMap.delete(callId);
      } catch (err) {
        this.logger.error('Failed to mark missed', err as any);
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
