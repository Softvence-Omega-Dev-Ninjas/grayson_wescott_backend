export interface Pagination {
  limit?: number;
  page?: number;
}

export interface LoadConversationsPayload extends Pagination {}

export interface LoadSingleConversationPayload extends Pagination {
  conversationId: string;
}
