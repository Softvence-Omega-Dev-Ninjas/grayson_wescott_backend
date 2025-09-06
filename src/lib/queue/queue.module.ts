import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { QueueName } from '@project/common/interface/queue-name';
import { RecognitionEventService } from './services/recognition-event.service';
import { RecognitionWorker } from './worker/recognition.worker';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QueueName.RECOGNITION })],
  providers: [RecognitionEventService, RecognitionWorker],
  exports: [BullModule],
})
export class QueueModule {}
