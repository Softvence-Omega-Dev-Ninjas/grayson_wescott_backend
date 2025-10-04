import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { ManageDailyExerciseDto } from '../dto/manage-daily-exercise.dto';

@Injectable()
export class ManageDailyProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to manage a daily exercise log', 'User Exercise Log')
  async manageADailyExerciseLog(
    uxId: string,
    data: ManageDailyExerciseDto,
  ): Promise<TResponse<any>> {
    const existingLog = await this.prisma.userProgramExercise.findUnique({
      where: { id: uxId },
    });

    if (!existingLog) {
      throw new AppError(404, 'Exercise log not found');
    }

    const updatedLog = await this.prisma.userProgramExercise.update({
      where: { id: uxId },
      data: {
        status: data.status,
        note: data?.note?.trim() ? data.note.trim() : existingLog.note,
        equipmentUsed: data?.equipmentUsed?.trim()
          ? data.equipmentUsed.trim()
          : existingLog.equipmentUsed,
        ...(data.status === 'COMPLETED' && !existingLog.completedAt,
        { completedAt: new Date() }),
      },
    });

    return successResponse(updatedLog, 'Exercise log updated successfully');
  }
}
