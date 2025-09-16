import { Pagination } from '@project/common/types/pagination.types';

// export interface LoadConversationsPayload extends Pagination {}

export interface LoadSingleConversationPayload extends Pagination {
  conversationId: string;
}
