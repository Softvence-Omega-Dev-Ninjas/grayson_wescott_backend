export enum ChatEventsEnum {
  // === Generic status events ===
  ERROR = 'private:error', // Server -> Client: operation failed
  SUCCESS = 'private:success', // Server -> Client: operation succeeded

  // === Messaging events ===
  SEND_MESSAGE_CLIENT = 'private:send_message_client', // Client -> Server: send new message by client to admins
  SEND_MESSAGE_ADMIN = 'private:send_message_admin', // Client -> Server: send new message by admin
  NEW_MESSAGE = 'private:new_message', // Server -> participants: broadcast new message
  UPDATE_MESSAGE_STATUS = 'private:update_message_status', // Server -> Client: message status update
  MARK_MESSAGE_READ = 'private:mark_message_read', // Client -> Server: mark message(s) as read

  // === Conversation events ===
  // FOR ADMIN
  LOAD_CONVERSATION_LIST = 'private:load_conversation_list', // Client -> Server: request conversation list
  CONVERSATION_LIST = 'private:conversation_list', // Server -> Client: conversation list response
  LOAD_SINGLE_CONVERSATION = 'private:load_single_conversation', // Client -> Server: request single conversation
  SINGLE_CONVERSATION = 'private:single_conversation', // Server -> Client: single conversation response
  INIT_CONVERSATION_WITH_CLIENT = 'private:init_conversation_with_client', // Client -> Server: initiate conversation with client

  // FOR CLIENT
  LOAD_CLIENT_CONVERSATION = 'private:load_client_conversation', // Client -> Server: request client conversation
  CLIENT_CONVERSATION = 'private:client_conversation', // Server -> Client: client conversation response

  // === Call lifecycle events ===
  CALL_INITIATE = 'private:call_initiate', // Client -> Server: start call
  CALL_INCOMING = 'private:call_incoming', // Server -> participants: incoming call notification
  CALL_ACCEPT = 'private:call_accept', // Client -> Server: accept call
  CALL_REJECT = 'private:call_reject', // Client -> Server: reject call
  CALL_JOIN = 'private:call_join', // Client -> Server: join ongoing call
  CALL_LEAVE = 'private:call_leave', // Client -> Server: leave call
  CALL_END = 'private:call_end', // Server -> participants: call ended
  CALL_MISSED = 'private:call_missed', // Server -> participants: missed call

  // === WebRTC signaling events ===
  RTC_OFFER = 'private:rtc_offer', // Client -> Server: send offer SDP
  RTC_ANSWER = 'private:rtc_answer', // Client -> Server: send answer SDP
  RTC_ICE_CANDIDATE = 'private:rtc_candidate', // Client -> Server: send ICE candidate
  RTC_SIGNAL = 'private:rtc_signal', // Server -> Participants: forward any signaling payload
}
