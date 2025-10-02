import { QUEUE_EVENTS } from './queue-events';

export interface QueueMeta {
  performedBy: string; // System or Any User
  recordType: string; // Prisma Model
  recordId: string; // Prisma Model Id
  others: {
    [key: string]: any;
  };
}

export interface NotificationPayload {
  type: QUEUE_EVENTS;
  title: string;
  message: string;
  createdAt: Date;
  meta: QueueMeta;
}

export interface QueuePayload extends NotificationPayload {
  recipients: { id: string }[];
}
