import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { ChatEventsEnum } from '../enum/chat-events.enum';
import { WebRTCPayload } from '../types/call-payloads';

@Injectable()
export class WebRTCService {
  private readonly logger = new Logger(WebRTCService.name);

  constructor(
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to send WebRTC offer', 'WebRTCService')
  async handleOffer(client: Socket, payload: WebRTCPayload) {
    this.chatGateway.emitToUser(
      payload.targetUserId,
      ChatEventsEnum.WEBRTC_OFFER,
      {
        from: client.data.userId,
        callId: payload.callId,
        sdp: payload.sdp,
      },
    );

    this.logger.log({
      message: 'WebRTC offer sent',
      from: client.data.userId,
      to: payload.targetUserId,
      callId: payload.callId,
    });
  }

  @HandleError('Failed to send WebRTC answer', 'WebRTCService')
  async handleAnswer(client: Socket, payload: WebRTCPayload) {
    this.chatGateway.emitToUser(
      payload.targetUserId,
      ChatEventsEnum.WEBRTC_ANSWER,
      {
        from: client.data.userId,
        callId: payload.callId,
        sdp: payload.sdp,
      },
    );

    this.logger.log({
      message: 'WebRTC answer sent',
      from: client.data.userId,
      to: payload.targetUserId,
      callId: payload.callId,
    });
  }

  @HandleError('Failed to send WebRTC ice candidate', 'WebRTCService')
  async handleIceCandidate(client: Socket, payload: WebRTCPayload) {
    this.chatGateway.emitToUser(
      payload.targetUserId,
      ChatEventsEnum.WEBRTC_ICE_CANDIDATE,
      {
        from: client.data.userId,
        callId: payload.callId,
        candidate: payload.candidate,
      },
    );

    this.logger.log({
      message: 'WebRTC ice candidate sent',
      from: client.data.userId,
      to: payload.targetUserId,
      callId: payload.callId,
    });
  }
}
