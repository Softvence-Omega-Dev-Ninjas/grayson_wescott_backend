import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ENVEnum } from '@project/common/enum/env.enum';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { QueueName } from '@project/lib/queue/interface/queue-names';
import { QueuePayload } from '@project/lib/queue/interface/queue-payload';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';

@Injectable()
export class DailyExerciseCron {
  private readonly logger = new Logger(DailyExerciseCron.name);
  private readonly queue: Queue<QueuePayload>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.queue = new Queue<QueuePayload>(QueueName.DAILY_EXERCISE, {
      connection: {
        host: this.config.getOrThrow(ENVEnum.REDIS_HOST),
        port: +this.config.getOrThrow(ENVEnum.REDIS_PORT),
      },
    });
  }

  // Runs every day at 1AM UTC
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyExercises() {
    this.logger.log('Enqueueing daily exercise jobs (producer)...');

    const nowUTC = DateTime.utc();

    // Fetch active user programs (only minimal data — keep payload small)
    const activeUserPrograms = await this.prisma.userProgram.findMany({
      where: {
        startDate: { lte: nowUTC.toJSDate() },
        endDate: { gte: nowUTC.toJSDate() },
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        userId: true,
        user: { select: { timezone: true } },
      },
    });

    if (activeUserPrograms.length === 0) {
      this.logger.log('No active user programs found.');
      return;
    }

    // Enqueue one job per user program (worker will fetch full program + exercises)
    const jobPromises = activeUserPrograms.map((up) => {
      const payload: QueuePayload = {
        recipients: [{ id: up.userId }],
        type: 'DAILY_EXERCISE' as any, // keep consistent with your QUEUE_EVENTS enum
        title: 'Daily Exercise',
        message: 'Daily Exercise available',
        createdAt: nowUTC.toJSDate(),
        meta: {
          performedBy: up.userId,
          recordType: 'UserProgram',
          recordId: up.id,
          others: {
            enqueuedAt: nowUTC.toISO(),
          },
        },
      };

      // Use a stable jobId to avoid duplicate enqueueing (optional)
      const jobId = `${up.id}-${nowUTC.toISODate()}`;

      return this.queue.add(up.id, payload, {
        jobId,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
    });

    await Promise.all(jobPromises);

    this.logger.log(
      `Enqueued ${activeUserPrograms.length} daily exercise job(s).`,
    );
  }
}
