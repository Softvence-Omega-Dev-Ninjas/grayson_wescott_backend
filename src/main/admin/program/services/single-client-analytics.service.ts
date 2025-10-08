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
    const { dailyLogDate } = query;
    const userTimezone = query.timezone || 'UTC';
    const targetDate = dailyLogDate
      ? DateTime.fromISO(dailyLogDate).setZone(userTimezone)
      : DateTime.now().setZone(userTimezone);

    const startOfDay = targetDate.startOf('day').toJSDate();
    const endOfDay = targetDate.endOf('day').toJSDate();

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
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(
      {
        user,
        programs: {
          data: programs.data,
          metadata: programs.metadata,
        },
        dailyExerciseLogs,
      },
      'Client analytics fetched successfully',
    );
  }
}
