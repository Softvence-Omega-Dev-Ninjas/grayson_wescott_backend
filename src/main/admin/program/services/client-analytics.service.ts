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

    // Apply filters
    const where: any = {
      role: 'USER',
      userPrograms: { some: {} }, // Filter clients with at least one program
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
            include: { program: true },
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
      const completionPercentage =
        totalWeeks > 0 && currentWeek > 0
          ? Math.min(100, Math.round((currentWeek / totalWeeks) * 100))
          : 0;

      return {
        userInfo: {
          id: client.id,
          avatarUrl: client.avatarUrl,
          name: client.name,
          email: client.email,
          lastActiveAt: client.lastActiveAt ?? 'Not logged in',
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
          completionPercentage,
        },
      };
    });

    return successPaginatedResponse(
      formattedClients,
      { page, limit, total },
      'Clients fetched successfully',
    );
  }
}
