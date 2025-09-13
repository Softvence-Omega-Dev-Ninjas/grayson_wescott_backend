export enum ChatEventsEnum {
  ERROR = 'private:error',
  SUCCESS = 'private:success',
  NEW_MESSAGE = 'private:new_message',
  SEND_MESSAGE = 'private:send_message',
  NEW_CONVERSATION = 'private:new_conversation',
  CONVERSATION_LIST = 'private:conversation_list',
  LOAD_CONVERSATIONS = 'private:load_conversations',
  LOAD_SINGLE_CONVERSATION = 'private:load_single_conversation',
  LOAD_MESSAGES = 'private:load_messages',
  MESSAGES = 'private:messages',
  MARK_READ = 'private:mark_read',
  MESSAGE_STATUS = 'private:message_status',
}
