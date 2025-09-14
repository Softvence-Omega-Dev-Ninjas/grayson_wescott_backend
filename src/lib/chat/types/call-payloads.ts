import { CallType } from '@prisma/client';

export interface InitiateCallPayload {
  conversationId: string;
  type: CallType;
  participantIds: string[];
}

export interface CallActionPayload {
  callId: string;
}

export interface CallJoinPayload {
  callId: string;
}

export interface WebRTCPayload {
  callId: string;
  targetUserId: string;
  sdp?: any; // offer/answer
  candidate?: any; // ICE candidate
}
