import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { getClientStats } from '../helper/client-stats.helper';
import { getLastNWeeksConsistency } from '../helper/consistency.helper';
import { computeLoadProgression } from '../helper/load-progression.helper';
import { computeProgramCompletionAdmin } from '../helper/program-completion.helper';
import { getProgramStats } from '../helper/program-stats.helper';
import { getLastNDaysRpeTrends } from '../helper/rpe-trends.helper';
import { computeWorkoutStatsAdmin } from '../helper/workout-stats.helper';

@Injectable()
export class ProgressStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch progress stats')
  async getProgressStats(adminId: string): Promise<TResponse<any>> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    const timezone = admin?.timezone || 'UTC';

    // Run independent async operations in parallel
    const [
      clients,
      programs,
      workouts,
      programCompletion,
      loadProgression,
      rpeTrends,
      consistency,
    ] = await Promise.all([
      getClientStats(this.prisma),
      getProgramStats(this.prisma),
      computeWorkoutStatsAdmin(this.prisma, timezone),
      computeProgramCompletionAdmin(this.prisma, timezone),
      computeLoadProgression(this.prisma, timezone),
      getLastNDaysRpeTrends(this.prisma),
      getLastNWeeksConsistency(this.prisma),
    ]);

    const data = {
      stats: {
        clients,
        programs,
        workouts,
        programCompletion,
      },
      graph: {
        loadProgression,
        rpeTrends,
        consistency,
      },
    };

    return successResponse(data, 'Progress stats fetched successfully');
  }
}
