import { IsOptional, IsString } from 'class-validator';

export class RTCOfferDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string; // Session Description

  // optional routing hints (userId or socketId)
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  from?: string;
}

export class RTCAnswerDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string;

  // optional routing hints (userId or socketId)
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  from?: string;
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

  // optional routing hints (userId or socketId)
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  from?: string;
}
