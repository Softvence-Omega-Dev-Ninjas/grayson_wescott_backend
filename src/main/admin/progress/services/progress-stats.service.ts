import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { getClientStats } from '../helper/client-stats.helper';
import { getProgramStats } from '../helper/program-stats.helper';
import { computeWorkoutStatsAdmin } from '../helper/workout-stats.helper';

@Injectable()
export class ProgressStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch progress stats')
  async getProgressStats(adminId: string): Promise<TResponse<any>> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });

    const clients = await getClientStats(this.prisma);
    const programs = await getProgramStats(this.prisma);
    const workouts = await computeWorkoutStatsAdmin(
      this.prisma,
      admin?.timezone || 'UTC',
    );

    const outPutData = {
      clients,
      programs,
      workouts,
      programCompletion: {
        total: {
          overallCompletionRate: '65%',
          completionRateIncrementThisWeek: '5%',
          completionRateIncrementThisMonth: '8%',
        },
        adherence: {
          overallAdherenceRate: '70%',
          adherenceRateThisWeek: '75%',
          adherenceRateThisMonth: '72%',
        },
      },
    };

    return successResponse(outPutData, 'Progress stats fetched successfully');
  }
}
