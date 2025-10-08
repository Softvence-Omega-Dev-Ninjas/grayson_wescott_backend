import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { successPaginatedResponse } from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';
import { CurrentlyAssignedProgramDto } from '../dto/currently-assigned-program.dto';

@Injectable()
export class GetAllProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get programs', 'USER_PROGRAM')
  async getAllPrograms(userId: string, query: CurrentlyAssignedProgramDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new AppError(404, 'User not found');

    const page = query.page && +query.page > 0 ? +query.page : 1;
    const limit = query.limit && +query.limit > 0 ? +query.limit : 10;
    const skip = (page - 1) * limit;

    const [userPrograms, total] = await this.prisma.$transaction([
      this.prisma.userProgram.findMany({
        where: { userId, ...(query.status && { status: query.status }) },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { program: true },
      }),
      this.prisma.userProgram.count({ where: { userId } }),
    ]);

    const userTimezone = user.timezone || 'UTC';
    const now = DateTime.now().setZone(userTimezone);

    const formattedPrograms = await Promise.all(
      userPrograms.map(async (up) => {
        const startDate = DateTime.fromJSDate(up.startDate).setZone(
          userTimezone,
        );
        const diffInDays = now
          .startOf('day')
          .diff(startDate.startOf('day'), 'days').days;
        const currentDay = diffInDays >= 0 ? Math.floor(diffInDays) + 1 : 0;
        const currentWeek = currentDay > 0 ? Math.ceil(currentDay / 7) : 0;

        const totalWeeks = up.program?.duration || 0;

        // fetch all exercises for this userProgram
        const allExercises = await this.prisma.userProgramExercise.findMany({
          where: { userProgramId: up.id },
        });

        const totalExercises = allExercises.length;
        const completedExercises = allExercises.filter(
          (e) => e.status === 'COMPLETED',
        ).length;

        // how many exercises should have been done up to today
        const scheduledToDate = allExercises.filter(
          (e) => e.dayNumber <= currentDay,
        ).length;

        // Completion % = done / total
        const completionPercentage =
          totalExercises > 0
            ? Math.round((completedExercises / totalExercises) * 100)
            : 0;

        // Adherence % = done / scheduled
        const adherencePercentage =
          scheduledToDate > 0
            ? Math.round(
                (allExercises.filter(
                  (e) => e.status === 'COMPLETED' && e.dayNumber <= currentDay,
                ).length /
                  scheduledToDate) *
                  100,
              )
            : 0;

        // Compliance % = done exercises on the exact scheduled day / scheduled to date
        const compliancePercentage =
          scheduledToDate > 0
            ? Math.round(
                (allExercises.filter(
                  (e) =>
                    e.status === 'COMPLETED' &&
                    e.dayNumber <= currentDay &&
                    e.completedAt, // assuming completedAt exists
                ).length /
                  scheduledToDate) *
                  100,
              )
            : 0;

        return {
          id: up.id,
          status: up.status,
          programId: up.programId,
          startDate: up.startDate,
          endDate: up.endDate,
          programName: up.program?.name || null,
          programDescription: up.program?.description || null,
          programDurationWeeks: totalWeeks,
          currentDayAsPerUser: currentDay,
          currentWeekAsPerUser: currentWeek,
          completionPercentage,
          adherencePercentage,
          compliancePercentage,
        };
      }),
    );

    return successPaginatedResponse(
      formattedPrograms,
      { page, limit, total },
      'Programs fetched successfully',
    );
  }
}
