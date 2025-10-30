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

      this.logger.log(
        `Sending early morning notifications to ${up.user.name} (${up.user.email})`,
      );
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

    this.logger.log(`Processed early morning notifications to ${count} users`);
  }

  /**
   * 🕛 North America region (UTC-5 → UTC-8)
   * Runs daily at 12:00 UTC (~4:00–7:00 AM local)
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM, {
    timeZone: 'America/New_York',
  })
  async handleAmericaMorningCron() {
    await this.notifyEarlyMorningUsers();
  }
}
