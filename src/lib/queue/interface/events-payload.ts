import { RecognitionMeta } from './events-meta';

export interface Notification {
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  meta: Record<string, any>;
}

export interface BaseEvent<TMeta> {
  action: string;
  meta: TMeta;
}

export interface RecognitionEvent extends BaseEvent<RecognitionMeta> {
  info: {
    title: string;
    recipients: { email: string; id: string }[];
  };
  action: 'RECOGNITION';
}
