import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatEventsEnum } from '../enum/chat-events.enum';
import { WebRTCPayload } from '../types/call-payloads';

@Injectable()
export class WebRTCService {
  constructor(private readonly server: Server) {}

  async handleOffer(client: Socket, payload: WebRTCPayload) {
    this.server.to(payload.targetUserId).emit(ChatEventsEnum.WEBRTC_OFFER, {
      from: client.data.userId,
      callId: payload.callId,
      sdp: payload.sdp,
    });
  }

  async handleAnswer(client: Socket, payload: WebRTCPayload) {
    this.server.to(payload.targetUserId).emit(ChatEventsEnum.WEBRTC_ANSWER, {
      from: client.data.userId,
      callId: payload.callId,
      sdp: payload.sdp,
    });
  }

  async handleIceCandidate(client: Socket, payload: WebRTCPayload) {
    this.server
      .to(payload.targetUserId)
      .emit(ChatEventsEnum.WEBRTC_ICE_CANDIDATE, {
        from: client.data.userId,
        callId: payload.callId,
        candidate: payload.candidate,
      });
  }
}
