import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch currently assigned program')
  async getCurrentlyAssignedProgram(userId: string): Promise<TResponse<any>> {
    // TODO: Implement logic to fetch the currently assigned program for the user
    const userProgram = await this.prisma.userProgram.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
      },
      include: {
        program: {
          include: {
            exercises: true,
          },
        },
      },
    });
    if (!userProgram) {
      return successResponse({}, 'No currently assigned program found');
    }

    return successResponse(
      {},
      'Currently assigned program fetched successfully',
    );
  }
}
