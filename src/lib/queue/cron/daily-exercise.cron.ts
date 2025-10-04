import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';
import { QUEUE_EVENTS } from '../interface/queue-events';
import {
  Channel,
  DailyExerciseJobPayload,
} from '../payload/daily-exercise.payload';

@Injectable()
export class DailyExerciseCron {
  private readonly logger = new Logger(DailyExerciseCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // @Cron(CronExpression.EVERY_10_SECONDS) // For testing, change to every 10 seconds
  // Runs every ten hours
  @Cron(CronExpression.EVERY_10_HOURS) // For production, uncomment this line
  async handleDailyExercises() {
    this.logger.log('Enqueueing daily exercise jobs (producer)...');

    const nowUTC = DateTime.utc();

    // * Fetch active user programs based on startDate and endDate
    const activeUserPrograms = await this.prisma.userProgram.findMany({
      where: {
        startDate: { lte: nowUTC.toJSDate() },
        endDate: { gte: nowUTC.toJSDate() },
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        userId: true,
        programId: true,
        user: {
          select: {
            timezone: true,
            email: true,
            phone: true,
            avatarUrl: true,
            name: true,
          },
        },
      },
    });

    // * Check if there are any active user programs
    if (!activeUserPrograms.length) {
      this.logger.log('No active user programs found.');
      return;
    }

    // * Emit event for each user program
    activeUserPrograms.forEach((up) => {
      const channels: Channel[] = ['socket', 'email'];

      if (up.user?.phone) {
        channels.push('sms');
      }

      const payload: DailyExerciseJobPayload = {
        event: QUEUE_EVENTS.DAILY_EXERCISE,
        programId: up.programId,
        recordType: 'userProgram',
        recordId: up.id,
        channels,
      };

      this.eventEmitter.emit(QUEUE_EVENTS.DAILY_EXERCISE, payload);
    });

    // * Log
    this.logger.log(
      `Enqueued ${activeUserPrograms.length} daily exercise job(s).`,
    );
  }
}
