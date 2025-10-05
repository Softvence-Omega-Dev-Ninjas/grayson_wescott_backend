import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';

@Injectable()
export class WorkUtHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError("Failed to get user's workout history", 'UserProgram')
  async getMyWorkoutHistory(
    userId: string,
    query: PaginationDto,
  ): Promise<TPaginatedResponse<any>> {
    // 1. Ensure user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // 2. Pagination setup
    const page = query.page && +query.page > 0 ? +query.page : 1;
    const limit = query.limit && +query.limit > 0 ? +query.limit : 10;
    const skip = (page - 1) * limit;

    // 3. Query data + count
    const [userPrograms, total] = await this.prisma.$transaction([
      this.prisma.userProgramExercise.findMany({
        where: {
          status: { not: 'PENDING' },
          userProgram: { userId },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          programExercise: true,
        },
      }),
      this.prisma.userProgramExercise.count({
        where: {
          status: { not: 'PENDING' },
          userProgram: { userId },
        },
      }),
    ]);

    const userTimezone = user.timezone || 'UTC';
    const now = DateTime.now().setZone(userTimezone);

    // 4. Map output properly
    const formattedHistory = userPrograms.map((exercise) => {
      const prog = exercise.programExercise;

      // compute training volume if sets & reps are available
      const computedVolume =
        prog?.sets && prog?.reps ? prog.sets * prog.reps : null;

      return {
        id: exercise.id,
        date: DateTime.fromJSDate(exercise.updatedAt)
          .setZone(userTimezone)
          .toFormat('DD TZZZ'),
        status: exercise.status,
        feedback: exercise.note,
        equipmentUsed: exercise.equipmentUsed,
        duration: prog?.duration ?? null,
        volume: computedVolume,
        completedAt: exercise.completedAt
          ? DateTime.fromJSDate(exercise.completedAt)
              .setZone(userTimezone)
              .toFormat('DD TZZZ')
          : null,
        workout: prog ?? null,
      };
    });

    // 5. Return consistent response
    return successPaginatedResponse(
      formattedHistory,
      { page, limit, total },
      `Workout history as of ${now.toFormat('DD TZZZ')}`,
    );
  }
}
