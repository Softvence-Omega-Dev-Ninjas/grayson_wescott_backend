import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { QueueName } from '@project/lib/queue/interface/queue-names';
import { DailyExerciseCron } from './cron/daily-exercise.cron';
import { QueueGateway } from './queue.gateway';
import { DailyExerciseEventService } from './services/daily-exercise-event.service';
import { HyperhumanCacheService } from './services/hyperhuman-cache.service';
import { DailyExerciseWorker } from './worker/daily-exercise.worker';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueName.DAILY_EXERCISE },
      { name: QueueName.NOTIFICATION },
      { name: QueueName.HYPERHUMAN_CACHE },
    ),
  ],
  providers: [
    QueueGateway,
    DailyExerciseCron,
    DailyExerciseEventService,
    DailyExerciseWorker,
    HyperhumanCacheService,
  ],
  exports: [BullModule],
})
export class QueueModule {}
