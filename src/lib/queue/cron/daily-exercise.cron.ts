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

  /**
   * Helper to send early morning notifications
   * @param region Optional filter for timezones by region (e.g., 'Asia', 'Europe', 'America')
   */
  private async notifyEarlyMorningUsers() {
    const nowUTC = DateTime.utc();

    // Fetch only active user programs with timezones
    const activeUserPrograms = await this.prisma.userProgram.findMany({
      where: {
        startDate: { lte: nowUTC.toJSDate() },
        endDate: { gte: nowUTC.toJSDate() },
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        programId: true,
        user: {
          select: {
            timezone: true,
            email: true,
            phone: true,
            name: true,
          },
        },
      },
    });

    let count = 0;

    // Iterate through user programs
    for (const up of activeUserPrograms) {
      const tz = up.user?.timezone;
      if (!tz) continue;

      const userNow = nowUTC.setZone(tz);

      // Target window: 1 AM – 12 PM local time
      if (userNow.hour >= 1 && userNow.hour <= 12) {
        const channels: Channel[] = ['socket', 'email'];
        if (up.user.phone) channels.push('sms');

        const payload: DailyExerciseJobPayload = {
          event: QUEUE_EVENTS.DAILY_EXERCISE,
          programId: up.programId,
          recordType: 'userProgram',
          recordId: up.id,
          channels,
        };

        // Emit asynchronously to avoid blocking event loop
        await this.eventEmitter.emitAsync(QUEUE_EVENTS.DAILY_EXERCISE, payload);
        count++;
      }
    }

    this.logger.log(`Sent early morning notifications to ${count} users`);
  }

  /**
   * 🕐 Asia region (UTC+5 → UTC+9)
   * Runs daily at 1:00 UTC (~6:00–10:00 AM local)
   */
  // @Cron(CronExpression.EVERY_DAY_AT_1AM)
  // async handleAsiaMorningCron() {
  //   await this.notifyEarlyMorningUsers();
  // }

  /**
   * 🕑 Europe region (UTC+0 → UTC+3)
   * Runs daily at 2:00 UTC (~2:00–5:00 AM local)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleEuropeMorningCron() {
    await this.notifyEarlyMorningUsers();
  }

  /**
   * 🕛 North America region (UTC-5 → UTC-8)
   * Runs daily at 12:00 UTC (~4:00–7:00 AM local)
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleAmericaMorningCron() {
    await this.notifyEarlyMorningUsers();
  }

  async onModuleInit() {
    await this.notifyEarlyMorningUsers();
  }
}
