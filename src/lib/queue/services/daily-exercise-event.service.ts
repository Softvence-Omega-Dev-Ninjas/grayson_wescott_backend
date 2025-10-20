import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QueueName } from '@project/lib/queue/interface/queue-names';
import { Queue } from 'bullmq';
import { QUEUE_EVENTS } from '../interface/queue-events';
import { DailyExerciseJobPayload } from './../payload/daily-exercise.payload';

@Injectable()
export class DailyExerciseEventService {
  private readonly logger = new Logger(DailyExerciseEventService.name);

  constructor(
    @InjectQueue(QueueName.DAILY_EXERCISE)
    private readonly queue: Queue,
  ) {}

  /**
   * Handles the `DAILY_EXERCISE` event
   */
  @OnEvent(QUEUE_EVENTS.DAILY_EXERCISE)
  async handleDailyExerciseCreate(payload: DailyExerciseJobPayload) {
    this.logger.log(
      `Enqueuing job for ${payload.recordType} ${payload.recordId}`,
    );
    try {
      await this.queue.add(QUEUE_EVENTS.DAILY_EXERCISE, payload, {
        // Automatically remove successful jobs to save Redis memory
        removeOnComplete: true,

        // Keep only the last 50 failed jobs for debugging
        removeOnFail: { count: 50 },

        // Retry up to 3 times if the job fails
        attempts: 3,

        // Exponential backoff for retries
        backoff: { type: 'exponential', delay: 5000 },

        // Optional: prevent duplicate jobs for the same record
        jobId: `${payload.recordType}:${payload.recordId}:${payload.programId}`,
      });

      this.logger.log(
        `Enqueued job for ${payload.recordType} ${payload.recordId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue job for ${payload.recordType} ${payload.recordId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
