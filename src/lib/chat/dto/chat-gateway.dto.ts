import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SendPrivateMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}

export class LoadSingleConversationByAdminDto {
  @IsString()
  conversationId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
