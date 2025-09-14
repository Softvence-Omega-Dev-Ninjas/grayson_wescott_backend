import { MessageDeliveryStatus, MessageType } from '@prisma/client';

export interface SendMessagePayload {
  conversationId: string;
  content?: string;
  type?: MessageType;
  fileId?: string;
}

export interface MarkReadPayload {
  messageId: string;
}

export interface LoadMessagesPayload {
  conversationId: string;
  limit?: number;
  cursor?: string; // for pagination
}

export interface MessageStatusPayload {
  messageId: string;
  status: MessageDeliveryStatus;
}
