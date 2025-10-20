import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class DashboardStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get dashboard stats')
  async getDashboardStats(userId: string): Promise<TResponse<any>> {
    const where: Prisma.UserProgramExerciseWhereInput = {
      userProgram: {
        userId,
      },
    };

    const completedWhere: Prisma.UserProgramExerciseWhereInput = {
      ...where,
      status: 'COMPLETED',
    };

    const totalAssignedTrainings = await this.prisma.userProgramExercise.count({
      where,
    });

    const totalCompletedTrainings = await this.prisma.userProgramExercise.count(
      { where: completedWhere },
    );

    const totalExerciseLibraryVideos =
      await this.prisma.libraryExercise.count(); // TODO: update count based on access level in next release

    return successResponse(
      {
        totalAssignedTrainings,
        totalCompletedTrainings,
        totalExerciseLibraryVideos,
      },
      'Dashboard stats fetched successfully',
    );
  }
}
