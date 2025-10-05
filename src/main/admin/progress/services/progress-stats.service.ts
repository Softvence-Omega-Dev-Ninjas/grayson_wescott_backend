import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { getClientStats } from '../helper/client-stats.helper';
import { computeProgramCompletionAdmin } from '../helper/program-completion.helper';
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
    const programCompletion = await computeProgramCompletionAdmin(
      this.prisma,
      admin?.timezone || 'UTC',
    );

    return successResponse(
      {
        clients,
        programs,
        workouts,
        programCompletion,
      },
      'Progress stats fetched successfully',
    );
  }
}
