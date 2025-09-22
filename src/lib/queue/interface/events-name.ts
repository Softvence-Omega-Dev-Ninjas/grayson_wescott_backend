import { RecognitionEvent } from './events-payload';

export const EVENT_TYPES = {
  RECOGNITION: 'recognition',
} as const;

export type EventPayloadMap = {
  [EVENT_TYPES.RECOGNITION]: RecognitionEvent;
};
