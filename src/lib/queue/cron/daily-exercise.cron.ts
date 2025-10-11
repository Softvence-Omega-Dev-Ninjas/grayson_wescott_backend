import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class DailyExerciseCron implements OnModuleInit {
  private readonly logger = new Logger(DailyExerciseCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Helper function to send notifications */
  private async notifyEarlyMorningUsers() {
    const nowUTC = DateTime.utc();

    const activeUserPrograms = await this.prisma.userProgram.findMany({
      where: { status: 'IN_PROGRESS' },
      select: {
        id: true,
        programId: true,
        user: {
          select: { timezone: true, email: true, phone: true, name: true },
        },
      },
    });

    let count = 0;

    activeUserPrograms.forEach((up) => {
      if (!up.user?.timezone) return;

      // Convert current UTC to user's local time
      const userNow = nowUTC.setZone(up.user.timezone);

      // Only send notifications if local time is between 5–7 AM
      if (userNow.hour >= 5 && userNow.hour <= 7) {
        const channels: Channel[] = ['socket', 'email'];
        if (up.user.phone) channels.push('sms');

        const payload: DailyExerciseJobPayload = {
          event: QUEUE_EVENTS.DAILY_EXERCISE,
          programId: up.programId,
          recordType: 'userProgram',
          recordId: up.id,
          channels,
        };

        this.eventEmitter.emit(QUEUE_EVENTS.DAILY_EXERCISE, payload);
        count++;
      }
    });

    this.logger.log(`Enqueued ${count} early morning notifications`);
  }

  /** Cron for South Asia & EU users */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // 00:00 UTC
  async handleDailyEarlyMorning1() {
    await this.notifyEarlyMorningUsers();
  }

  /** Cron for North America users */
  @Cron(CronExpression.EVERY_DAY_AT_NOON) // 12:00 UTC
  async handleDailyEarlyMorning2() {
    await this.notifyEarlyMorningUsers();
  }

  // fallback cron to run every 10 hours
  @Cron(CronExpression.EVERY_10_HOURS)
  async handleDailyEarlyMorning3() {
    await this.notifyEarlyMorningUsers();
  }

  onModuleInit() {
    this.handleDailyEarlyMorning1();
    this.handleDailyEarlyMorning2();
  }
}
