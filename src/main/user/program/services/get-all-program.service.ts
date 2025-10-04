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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const page = query.page && +query.page > 0 ? +query.page : 1;
    const limit = query.limit && +query.limit > 0 ? +query.limit : 10;
    const skip = (page - 1) * limit;

    // get programs with program details
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

    // map into clean DTO
    const formattedPrograms = userPrograms.map((up) => {
      const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);

      // calculate dayNumber & weekNumber relative to startDate
      const diffInDays = now
        .startOf('day')
        .diff(startDate.startOf('day'), 'days').days;
      const currentDay = diffInDays >= 0 ? Math.floor(diffInDays) + 1 : 0;
      const currentWeek = currentDay > 0 ? Math.ceil(currentDay / 7) : 0;

      const totalWeeks = up.program?.duration || 0;
      const completionPercentage =
        totalWeeks > 0 && currentWeek > 0
          ? Math.min(100, Math.round((currentWeek / totalWeeks) * 100))
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
      };
    });

    return successPaginatedResponse(
      formattedPrograms,
      { page, limit, total },
      'Programs fetched successfully',
    );
  }
}
