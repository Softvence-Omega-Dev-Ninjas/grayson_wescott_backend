import { IsString, IsOptional } from 'class-validator';

export class SendPrivateMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}
