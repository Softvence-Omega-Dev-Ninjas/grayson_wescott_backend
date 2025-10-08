import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { successResponse } from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { GetAllProgramService } from '@project/main/user/program/services/get-all-program.service';
import { DateTime } from 'luxon';
import { SingleClientAnalyticsDto } from '../dto/get-client.dto';

@Injectable()
export class SingleClientAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly getAllProgramService: GetAllProgramService,
  ) {}

  @HandleError('Failed to get client analytics', 'User')
  async getSingleClientAnalytics(
    userId: string,
    query: SingleClientAnalyticsDto,
  ) {
    const { dailyLogDate = new Date().toISOString() } = query;
    const userTimezone = query.timezone || 'UTC';

    // Set target date
    const targetDate = dailyLogDate
      ? DateTime.fromISO(dailyLogDate).setZone(userTimezone)
      : DateTime.now().setZone(userTimezone);

    const startOfDay = targetDate.startOf('day').toJSDate();
    const endOfDay = targetDate.endOf('day').toJSDate();

    // Weekly range
    const weekStart = query.weekStart
      ? DateTime.fromISO(query.weekStart).setZone(userTimezone)
      : targetDate.startOf('week');
    const weekEnd = query.weekEnd
      ? DateTime.fromISO(query.weekEnd).setZone(userTimezone)
      : targetDate.endOf('week');

    const startOfWeek = weekStart.startOf('day').toJSDate();
    const endOfWeek = weekEnd.endOf('day').toJSDate();

    // Fetch user info
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        lastActiveAt: true,
        avatarUrl: true,
      },
    });

    // Fetch all programs with stats
    const programs = await this.getAllProgramService.getAllPrograms(
      userId,
      query,
    );

    // Fetch daily exercise logs in a single query
    const dailyExerciseLogs = await this.prisma.userProgramExercise.findMany({
      where: {
        userProgram: { userId },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        userProgram: {
          select: {
            id: true,
            programId: true,
            program: { select: { name: true } },
          },
        },
        programExercise: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Weekly summary
    const weeklyExercises = await this.prisma.userProgramExercise.findMany({
      where: {
        userProgram: { userId },
        createdAt: { gte: startOfWeek, lte: endOfWeek },
      },
      include: { programExercise: true },
    });

    const totalSets = weeklyExercises.reduce((acc, ex) => {
      if (ex.status === 'COMPLETED' && ex.programExercise?.sets) {
        return acc + ex.programExercise.sets;
      }
      return acc;
    }, 0);

    // lbs moved (if weight is stored in equipmentUsed, parse number)
    const totalLbsMoved = weeklyExercises.reduce((acc, ex) => {
      if (ex.status === 'COMPLETED' && ex.programExercise?.sets) {
        const sets = ex.programExercise.sets || 0;
        const weightMatch = ex.programExercise?.title.match(/(\d+)\s?lbs/i);
        const weight = weightMatch ? parseInt(weightMatch[1], 10) : 0;
        return acc + sets * weight;
      }
      return acc;
    }, 0);

    const newPRs = 0; // model doesn't track PRs
    const missedReps = weeklyExercises.filter(
      (ex) => ex.status === 'SKIPPED' || ex.status === 'PENDING',
    ).length;

    const weeklySummary = {
      totalSets,
      totalLbsMoved,
      newPRs,
      missedReps,
    };

    return successResponse(
      {
        user,
        programs: {
          data: programs.data,
          metadata: programs.metadata,
        },
        dailyExerciseLogs: {
          date: targetDate,
          data: dailyExerciseLogs.flatMap((log) => log.programExercise),
        },
        weeklySummary,
      },
      'Client analytics fetched successfully',
    );
  }
}
