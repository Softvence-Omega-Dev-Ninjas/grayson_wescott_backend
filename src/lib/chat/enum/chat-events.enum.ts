export enum ChatEventsEnum {
  // === Generic status events ===
  ERROR = 'private:error', // Server -> Client: when an operation fails
  SUCCESS = 'private:success', // Server -> Client: when an operation succeeds

  // === Messaging events ===
  SEND_MESSAGE = 'private:send_message', // Client -> Server: request to send a new message
  NEW_MESSAGE = 'private:new_message', // Server -> participants: broadcast when a new message is created
  LOAD_MESSAGES = 'private:load_messages', // Client -> Server: request messages of a conversation
  MESSAGES = 'private:messages', // Server -> Client: response with messages of a conversation
  MARK_READ = 'private:mark_read', // Client -> Server: mark message(s) as read
  MESSAGE_STATUS = 'private:message_status', // Server -> Client: notify delivery/read status update

  // === Conversation events ===
  NEW_CONVERSATION = 'private:new_conversation', // Server -> Client: notify when a new conversation is created
  LOAD_CONVERSATIONS = 'private:load_conversations', // Client -> Server: request conversation list
  CONVERSATION_LIST = 'private:conversation_list', // Server -> Client: response with conversation list
  LOAD_SINGLE_CONVERSATION = 'private:load_single_conversation', // Client -> Server: request a single conversation

  // === Call lifecycle events ===
  CALL_INITIATE = 'private:call_initiate', // Client -> Server: start a call
  CALL_INCOMING = 'private:call_incoming', // Server -> Participants: notify incoming call
  CALL_ACCEPT = 'private:call_accept', // Client -> Server: accept a call
  CALL_REJECT = 'private:call_reject', // Client -> Server: reject a call
  CALL_JOIN = 'private:call_join', // Client -> Server: join an ongoing call
  CALL_LEAVE = 'private:call_leave', // Client -> Server: leave the call
  CALL_END = 'private:call_end', // Server -> Participants: call has ended
  CALL_MISSED = 'private:call_missed', // Server -> Participants: call was not answered

  // === WebRTC signaling events ===
  WEBRTC_OFFER = 'private:webrtc_offer', // Client -> Server -> Other Client: SDP offer
  WEBRTC_ANSWER = 'private:webrtc_answer', // Client -> Server -> Other Client: SDP answer
  WEBRTC_ICE_CANDIDATE = 'private:webrtc_ice', // Client -> Server -> Other Client: ICE candidate exchange

  // === Call events ===
  CALL_RECORDING_STARTED = 'private:call_recording_started', // Server -> Participants: call recording started
  CALL_RECORDING_ENDED = 'private:call_recording_ended', // Server -> Participants: call recording ended
}
