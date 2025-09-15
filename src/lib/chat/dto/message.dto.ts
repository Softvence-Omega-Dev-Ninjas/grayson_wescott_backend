import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageDeliveryStatus, MessageType } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// ----------------------
// Base DTO
// ----------------------
export class BaseMessageDto {
  @ApiPropertyOptional({
    description: 'Conversation ID, optional for first message',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Message content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: MessageType, description: 'Type of message' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'File ID if sending a file' })
  @IsOptional()
  @IsString()
  fileId?: string;
}

// ----------------------
// Client → Admin
// ----------------------
export class ClientMessageDto extends BaseMessageDto {}

// ----------------------
// Admin → Client
// ----------------------
export class AdminMessageDto extends BaseMessageDto {
  @ApiProperty({ description: 'Client ID to send message to' })
  @IsNotEmpty()
  @IsString()
  clientId: string;
}

// ----------------------
// Mark message as read
// ----------------------
export class MarkReadDto {
  @ApiProperty({ description: 'ID of the message to mark as read' })
  @IsNotEmpty()
  @IsString()
  messageId: string;
}

// ----------------------
// Load messages with pagination
// ----------------------
export class LoadMessagesDto extends PaginationDto {
  @ApiProperty({ description: 'Conversation ID to load messages from' })
  @IsNotEmpty()
  @IsString()
  conversationId: string;
}

// ----------------------
// Update message delivery status
// ----------------------
export class MessageStatusDto {
  @ApiProperty({ description: 'ID of the message' })
  @IsNotEmpty()
  @IsString()
  messageId: string;

  @ApiProperty({
    enum: MessageDeliveryStatus,
    description: 'New delivery status of the message',
  })
  @IsEnum(MessageDeliveryStatus)
  status: MessageDeliveryStatus;
}
