import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';
import { GetAllClientsDto } from '../dto/get-client.dto';

@Injectable()
export class ClientAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get client analytics', 'USER')
  async getAllClientAnalytics(
    query: GetAllClientsDto,
  ): Promise<TPaginatedResponse<any>> {
    const page = query.page && +query.page > 0 ? +query.page : 1;
    const limit = query.limit && +query.limit > 0 ? +query.limit : 10;
    const skip = (page - 1) * limit;
    const { search, status } = query;

    // Filters
    const where: any = {
      role: 'USER',
      userPrograms: { some: {} }, // clients with at least one program
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [clients, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          userPrograms: {
            orderBy: { startDate: 'desc' },
            take: 1,
            include: {
              program: { include: { exercises: true } }, // template exercises
              userProgramExercise: true, // actual scheduled/completed rows
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formattedClients = clients.map((client) => {
      const latestProgram = client.userPrograms?.[0];
      const userTimezone = client.timezone || 'UTC';
      const now = DateTime.now().setZone(userTimezone);

      const startDate = DateTime.fromJSDate(latestProgram.startDate).setZone(
        userTimezone,
      );

      const diffInDays = now
        .startOf('day')
        .diff(startDate.startOf('day'), 'days').days;
      const currentDay = diffInDays >= 0 ? Math.floor(diffInDays) + 1 : 0;
      const currentWeek = currentDay > 0 ? Math.ceil(currentDay / 7) : 0;

      const totalWeeks = latestProgram.program?.duration || 0;

      // --- Workload-based totals (important change) ---
      const exercisesPerWeek = latestProgram.program?.exercises?.length || 0;
      const totalWorkouts = exercisesPerWeek * totalWeeks; // template length * duration
      const completedWorkouts = latestProgram.userProgramExercise.filter(
        (e) => e.status === 'COMPLETED',
      ).length;

      const scheduledToDate = latestProgram.userProgramExercise.filter(
        (e) => e.dayNumber <= currentDay,
      ).length;

      // Percentages (workout-based)
      const completionPercentage =
        totalWorkouts > 0
          ? Math.round((completedWorkouts / totalWorkouts) * 100)
          : 0;

      const compliancePercentage =
        scheduledToDate > 0
          ? Math.round((completedWorkouts / scheduledToDate) * 100)
          : 0;

      // Keep the original time-based progress as a separate field
      const timeProgressPercentage =
        totalWeeks > 0 && currentWeek > 0
          ? Math.min(100, Math.round((currentWeek / totalWeeks) * 100))
          : 0;

      return {
        userInfo: {
          id: client.id,
          avatarUrl: client.avatarUrl,
          status: client.status,
          name: client.name,
          email: client.email,
          lastActiveAt: this.formatLastActive(
            client.lastActiveAt,
            userTimezone,
          ),
        },
        latestAssignedProgram: {
          id: latestProgram.id,
          status: latestProgram.status,
          programId: latestProgram.programId,
          startDate: latestProgram.startDate,
          endDate: latestProgram.endDate,
          programName: latestProgram.program?.name || null,
          programDescription: latestProgram.program?.description || null,
          programDurationWeeks: totalWeeks,
          currentDayAsPerUser: currentDay,
          currentWeekAsPerUser: currentWeek,

          // --- workload-based metrics ---
          totalWorkouts, // template exercises * duration
          completedWorkouts, // completed userProgramExercises
          scheduledToDate, // scheduled up to current day
          completionPercentage, // completed / totalWorkouts
          compliancePercentage, // completed / scheduledToDate

          // --- time-based metric (kept for reference) ---
          timeProgressPercentage, // currentWeek / totalWeeks
        },
      };
    });

    return successPaginatedResponse(
      formattedClients,
      { page, limit, total },
      'Clients fetched successfully',
    );
  }

  private formatLastActive(
    lastActiveAt: Date | null,
    userTimezone: string,
  ): string {
    if (!lastActiveAt) return 'Not logged in';

    const now = DateTime.now().setZone(userTimezone);
    const lastActive = DateTime.fromJSDate(lastActiveAt).setZone(userTimezone);

    const diff = now.diff(lastActive, ['days', 'hours', 'minutes']).toObject();
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
