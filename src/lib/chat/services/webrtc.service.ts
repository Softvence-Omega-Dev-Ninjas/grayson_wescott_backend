import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { EventsEnum } from '../../../common/enum/events.enum';
import { ChatGateway } from '../chat.gateway';

@Injectable()
export class WebRTCService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to handle offer', 'WebRTCService')
  async handleOffer(
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

    // Forward offer to all other participants
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

  @HandleError('Failed to handle answer', 'WebRTCService')
  async handleAnswer(
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

  @HandleError('Failed to handle ICE candidate', 'WebRTCService')
  async handleCandidate(
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
        this.chatGateway.server
          .to(p.userId)
          .emit(
            EventsEnum.RTC_ICE_CANDIDATE,
            successResponse({ ...payload, from: userId }),
          ),
      );

    return successResponse(payload, 'Candidate forwarded');
  }
}
