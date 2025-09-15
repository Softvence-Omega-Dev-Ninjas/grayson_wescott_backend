export enum ChatEventsEnum {
  // === Generic status events ===
  ERROR = 'private:error', // Server -> Client: operation failed
  SUCCESS = 'private:success', // Server -> Client: operation succeeded

  // === Messaging events ===
  SEND_MESSAGE_CLIENT = 'private:send_message_client', // Client -> Server: send new message by client to admins
  SEND_MESSAGE_ADMIN = 'private:send_message_admin', // Client -> Server: send new message by admin
  NEW_MESSAGE = 'private:new_message', // Server -> participants: broadcast new message
  LOAD_MESSAGES = 'private:load_messages', // Client -> Server: request messages
  MESSAGES = 'private:messages', // Server -> Client: messages response
  MARK_READ = 'private:mark_read', // Client -> Server: mark message(s) as read
  MESSAGE_STATUS = 'private:message_status', // Server -> Client: delivery/read update

  // === Conversation events ===
  LOAD_CONVERSATIONS = 'private:load_conversations', // Client -> Server: request conversation list
  CONVERSATION_LIST = 'private:conversation_list', // Server -> Client: conversation list response
  LOAD_SINGLE_CONVERSATION = 'private:load_single_conversation', // Client -> Server: request single conversation
  CONVERSATION_LOAD = 'private:conversation_load', // Server -> Client: single conversation response

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
  WEBRTC_OFFER = 'private:webrtc_offer', // Client -> Server -> Other participant: SDP offer
  WEBRTC_ANSWER = 'private:webrtc_answer', // Client -> Server -> Other participant: SDP answer
  WEBRTC_ICE_CANDIDATE = 'private:webrtc_ice', // Client -> Server -> Other participant: ICE candidate

  // === Call recording events ===
  CALL_RECORDING_STARTED = 'private:call_recording_started', // Server -> participants: recording started
  CALL_RECORDING_ENDED = 'private:call_recording_ended', // Server -> participants: recording ended

  // === Notification events ===
  NOTIFICATION_NEW_MESSAGE = 'private:notification_new_message', // Server -> Client: new message notification for offline users
}
