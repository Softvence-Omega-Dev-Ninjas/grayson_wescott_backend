export interface LoadConversationsPayload {
  limit?: number;
  cursor?: string; // pagination
}

export interface LoadSingleConversationPayload {
  conversationId: string;
}

export interface NewConversationPayload {
  userId: string;
  adminGroupId: string;
  initialMessage?: string;
}
