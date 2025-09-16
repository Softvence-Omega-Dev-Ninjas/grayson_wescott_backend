import { IsString } from 'class-validator';

export class RTCOfferDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string; // Session Description
}

export class RTCAnswerDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string;
}

export class RTCIceCandidateDto {
  @IsString()
  callId: string;

  @IsString()
  candidate: string;

  @IsString()
  sdpMid: string;

  @IsString()
  sdpMLineIndex: string;
}
