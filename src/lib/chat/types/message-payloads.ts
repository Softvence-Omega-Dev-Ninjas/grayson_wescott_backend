import { MessageDeliveryStatus, MessageType } from '@prisma/client';

// common base for client → admin and admin → client
export interface BaseMessagePayload {
  conversationId?: string; // optional → first message may not have one
  content?: string;
  type?: MessageType;
  fileId?: string;
}

// client → admin(s)
// export interface ClientMessagePayload extends BaseMessagePayload {}

// admin → client
export interface AdminMessagePayload extends BaseMessagePayload {
  clientId: string; // required for admin (to know which client to send to if new)
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
