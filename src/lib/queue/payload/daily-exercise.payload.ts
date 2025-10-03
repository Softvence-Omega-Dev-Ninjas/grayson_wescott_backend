import { QUEUE_EVENTS } from '../interface/queue-events';

export type Channel = 'socket' | 'email' | 'sms';

export type DailyExerciseJobPayload = {
  event: QUEUE_EVENTS.DAILY_EXERCISE;

  programId: string;

  recordType: 'userProgram';
  recordId: string;

  channels: Channel[];
};
