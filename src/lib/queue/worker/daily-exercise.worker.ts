import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Job, Worker } from 'bullmq';
import { QueueName } from '../interface/queue-names';
import { QueuePayload } from '../interface/queue-payload';
import { QueueGateway } from '../queue.gateway';

@Injectable()
export class DailyExerciseWorker implements OnModuleInit {
  private logger = new Logger(DailyExerciseWorker.name);

  constructor(
    private readonly gateway: QueueGateway,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    new Worker<QueuePayload>(
      QueueName.DAILY_EXERCISE,
      async (job: Job<QueuePayload>) => {
        const { type, recipients, title, message, createdAt, meta } = job.data;

        try {
          // * Send Socket Notification
          this.gateway.notifyMultipleUsers(
            recipients.map((recipient: any) => recipient.id),
            type,
            {
              type,
              title,
              message,
              createdAt,
              meta,
            },
          );

          // * Store the notification in the database
          await this.prisma.notification.create({
            data: {
              type,
              title,
              message,
              meta: JSON.stringify(meta),
              users: {
                createMany: {
                  data: recipients.map((recipient: any) => ({
                    userId: recipient.id,
                  })),
                },
              },
            },
          });
        } catch (err) {
          this.logger.error(
            `Failed to process notification event ${type}: ${err.message}`,
            err.stack,
          );
        }
      },
      {
        connection: {
          host: this.config.getOrThrow(ENVEnum.REDIS_HOST),
          port: +this.config.getOrThrow(ENVEnum.REDIS_PORT),
        },
      },
    );
  }
}
