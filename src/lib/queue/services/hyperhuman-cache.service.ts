import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GetWorkoutsFromHyperhumanDto } from '@project/main/admin/library/dto/get-workouts-from-hyperhuman.dto';
import { Queue } from 'bullmq';
import { QUEUE_EVENTS } from '../interface/queue-events';
import { QueueName } from '../interface/queue-names';

@Injectable()
export class HyperhumanCacheService {
  private readonly logger = new Logger(HyperhumanCacheService.name);

  constructor(
    @InjectQueue(QueueName.HYPERHUMAN_CACHE)
    private readonly queue: Queue,
  ) {}

  @OnEvent(QUEUE_EVENTS.HYPERHUMAN_CACHE_WORKOUT)
  async cacheWorkouts(query: GetWorkoutsFromHyperhumanDto) {
    try {
      await this.queue.add(QUEUE_EVENTS.HYPERHUMAN_CACHE_WORKOUT, query, {
        attempts: 2,
      });

      this.logger.log(`Enqueued job for query ${JSON.stringify(query)}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue job: ${error.message}`, error.stack);
    }
  }

  @OnEvent(QUEUE_EVENTS.HYPERHUMAN_CACHE_WORKOUT_BY_ID)
  async cacheWorkoutById(workoutId: string) {
    try {
      await this.queue.add(
        QUEUE_EVENTS.HYPERHUMAN_CACHE_WORKOUT_BY_ID,
        { workoutId },
        { attempts: 2 },
      );

      this.logger.log(`Enqueued job for workoutId ${workoutId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue job: ${error.message}`, error.stack);
    }
  }
}
