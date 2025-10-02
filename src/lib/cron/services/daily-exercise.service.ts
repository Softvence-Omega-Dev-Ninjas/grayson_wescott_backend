import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';

@Injectable()
export class DailyExerciseService {
  private readonly logger = new Logger(DailyExerciseService.name);

  constructor(private prisma: PrismaService) {}

  // Runs every day at 1AM UTC
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyExercises() {
    this.logger.log('Running daily exercise cron job...');

    const nowUTC = DateTime.utc();

    // 1. Fetch all active user programs
    const activeUserPrograms = await this.prisma.userProgram.findMany({
      where: {
        startDate: { lte: nowUTC.toJSDate() },
        endDate: { gte: nowUTC.toJSDate() },
        status: 'IN_PROGRESS',
      },
      include: {
        user: true,
        program: { include: { exercises: true } },
      },
    });

    for (const userProgram of activeUserPrograms) {
      const userTZ = userProgram.user.timezone || 'UTC';
      const userNow = nowUTC.setZone(userTZ);

      // 2. Calculate day number
      const startDate = DateTime.fromJSDate(userProgram.startDate).setZone(
        userTZ,
      );
      const dayNumber = userNow.diff(startDate, 'days').days + 1;

      // 3. Get day of week
      const dayOfWeek = userNow.toFormat('EEEE').toUpperCase(); // MONDAY, TUESDAY, ...

      // 4. Filter exercises
      const todaysExercises = userProgram.program.exercises.filter(
        (ex) => ex.dayOfWeek === dayOfWeek,
      );

      if (!todaysExercises.length) continue;

      // 5. Create UserProgramExercise entries
      await this.prisma.userProgramExercise.createMany({
        data: todaysExercises.map((ex) => ({
          userProgramId: userProgram.id,
          programExerciseId: ex.id,
          status: 'PENDING',
          dayNumber: Math.floor(dayNumber),
        })),
        skipDuplicates: true,
      });

      // 6. Send notification
    }

    this.logger.log('Daily exercise cron job completed.');
  }
}
