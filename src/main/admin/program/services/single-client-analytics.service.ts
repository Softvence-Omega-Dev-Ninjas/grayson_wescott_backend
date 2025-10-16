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

    const targetDate = DateTime.fromISO(dailyLogDate).setZone(userTimezone);
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

    // 🔹 Fetch full user info with providers and programs count
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        authProviders: true,
        userPrograms: { select: { id: true, status: true } },
      },
    });

    // 🔹 Count auth providers
    const providerCount = user.authProviders.length;
    const providerNames = user.authProviders.map((p) => p.provider);

    // 🔹 Program counts
    const totalPrograms = user.userPrograms.length;
    const activePrograms = user.userPrograms.filter(
      (p) => p.status === 'IN_PROGRESS',
    ).length;
    const completedPrograms = user.userPrograms.filter(
      (p) => p.status === 'COMPLETED',
    ).length;

    // 🔹 Format time info
    const formattedLastLogin = this.formatTimeAgo(
      user.lastLoginAt,
      userTimezone,
    );
    const formattedLastActive = this.formatTimeAgo(
      user.lastActiveAt,
      userTimezone,
    );
    const formattedCreatedAt = DateTime.fromJSDate(user.createdAt)
      .setZone(userTimezone)
      .toFormat('DDD');

    // 🔹 Fetch all programs via existing service
    const programs = await this.getAllProgramService.getAllPrograms(
      userId,
      query,
    );

    // 🔹 Daily and weekly exercise logs
    const [dailyExerciseLogs, weeklyExercises] = await Promise.all([
      this.prisma.userProgramExercise.findMany({
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
      }),
      this.prisma.userProgramExercise.findMany({
        where: {
          userProgram: { userId },
          createdAt: { gte: startOfWeek, lte: endOfWeek },
        },
        include: { programExercise: true },
      }),
    ]);

    // 🔹 Weekly summary calculations
    const totalSets = weeklyExercises.reduce((acc, ex) => {
      if (ex.status === 'COMPLETED' && ex.programExercise?.sets) {
        return acc + ex.programExercise.sets;
      }
      return acc;
    }, 0);

    const totalLbsMoved = weeklyExercises.reduce((acc, ex) => {
      if (ex.status === 'COMPLETED' && ex.programExercise?.sets) {
        const sets = ex.programExercise.sets || 0;
        const weightMatch = ex.programExercise?.title.match(/(\d+)\s?lbs/i);
        const weight = weightMatch ? parseInt(weightMatch[1], 10) : 0;
        return acc + sets * weight;
      }
      return acc;
    }, 0);

    const missedReps = weeklyExercises.filter(
      (ex) => ex.status === 'SKIPPED' || ex.status === 'PENDING',
    ).length;

    const weeklySummary = {
      totalSets,
      totalLbsMoved,
      newPRs: 0,
      missedReps,
    };

    // 🔹 Construct rich response
    const detailedUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      signUpMethod: user.signUpMethod,
      timezone: user.timezone,
      createdAt: formattedCreatedAt,
      isVerified: user.isVerified,
      providerCount,
      providers: providerNames,
      lastLoginAt: formattedLastLogin,
      lastActiveAt: formattedLastActive,
      totalPrograms,
      activePrograms,
      completedPrograms,
    };

    return successResponse(
      {
        user: detailedUser,
        programs: {
          data: programs.data,
          metadata: programs.metadata,
        },
        dailyExerciseLogs: {
          date: targetDate.toISO(),
          data: dailyExerciseLogs.flatMap((log) => log.programExercise),
        },
        weeklySummary,
      },
      'Client analytics fetched successfully',
    );
  }

  // Helper to format last active / login times
  private formatTimeAgo(date: Date | null, timezone: string): string {
    if (!date) return 'Not available';
    const now = DateTime.now().setZone(timezone);
    const target = DateTime.fromJSDate(date).setZone(timezone);
    const diff = now.diff(target, ['days', 'hours', 'minutes']).toObject();

    const days = Math.floor(diff.days || 0);
    const hours = Math.floor(diff.hours || 0);
    const minutes = Math.floor(diff.minutes || 0);

    if (days <= 0 && hours <= 0 && minutes < 1) return 'Just now';
    if (days <= 0 && hours > 0)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days <= 0 && hours <= 0 && minutes >= 1)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    return `${days} day${days > 1 ? 's' : ''}${
      hours > 0 ? ` ${hours} hour${hours > 1 ? 's' : ''}` : ''
    } ago`;
  }
}
