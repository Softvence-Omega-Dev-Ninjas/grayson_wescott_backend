import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class RTCOfferDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  from?: string;
}

export class RTCAnswerDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string;

  @IsString()
  to: string;

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

  @Type(() => Number)
  @IsNumber()
  sdpMLineIndex: number;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  from?: string;
}
