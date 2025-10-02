import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { QueueName } from '@project/lib/queue/interface/queue-name';
import { QueueGateway } from './queue.gateway';
import { RecognitionEventService } from './services/recognition-event.service';
import { RecognitionWorker } from './worker/recognition.worker';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QueueName.RECOGNITION })],
  providers: [QueueGateway, RecognitionEventService, RecognitionWorker],
  exports: [BullModule],
})
export class QueueModule {}
