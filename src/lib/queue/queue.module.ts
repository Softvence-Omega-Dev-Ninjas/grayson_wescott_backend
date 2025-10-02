import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { QueueName } from '@project/lib/queue/interface/queue-names';
import { QueueGateway } from './queue.gateway';
import { DailyExerciseEventService } from './services/daily-exercise-event.service';
import { DailyExerciseWorker } from './worker/daily-exercise.worker';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QueueName.DAILY_EXERCISE })],
  providers: [QueueGateway, DailyExerciseEventService, DailyExerciseWorker],
  exports: [BullModule],
})
export class QueueModule {}
