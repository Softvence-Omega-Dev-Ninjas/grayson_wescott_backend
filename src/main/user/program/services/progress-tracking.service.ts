import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class ProgressTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get user progress', 'USER_PROGRAM')
  async getUserProgress(userId: string): Promise<TResponse<any>> {
    const totalPrograms = await this.prisma.userProgram.count({
      where: { userId },
    });

    const progressTracking = [];

    const workoutHistory = [];

    return successResponse(
      totalPrograms,
      'User progress retrieved successfully',
    );
  }
}
