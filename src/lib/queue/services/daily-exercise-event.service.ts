import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QueueName } from '@project/lib/queue/interface/queue-names';
import { Queue } from 'bullmq';
import { QUEUE_EVENTS } from '../interface/queue-events';
import { QueuePayload } from '../interface/queue-payload';

@Injectable()
export class DailyExerciseEventService {
  constructor(
    @InjectQueue(QueueName.DAILY_EXERCISE)
    private readonly queue: Queue,
  ) {}

  /**
   * Handles the `DAILY_EXERCISE` event
   */
  @OnEvent(QUEUE_EVENTS.DAILY_EXERCISE)
  async handleDailyExerciseCreate(payload: QueuePayload) {
    // Enqueue for processing by worker
    await this.queue.add(QUEUE_EVENTS.DAILY_EXERCISE, payload);
  }
}
