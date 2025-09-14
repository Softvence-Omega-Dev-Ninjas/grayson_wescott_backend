export interface LoadConversationsPayload {
  limit?: number;
  cursor?: string; // pagination
}

export interface LoadSingleConversationPayload {
  conversationId: string;
}

export interface NewConversationPayload {
  participantIds: string[];
  initialMessage?: string;
}
