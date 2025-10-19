import { Injectable, Logger } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { CreateLibraryExerciseDto } from '../dto/create-library-exercise.dto';

@Injectable()
export class CreateExerciseService {
  private readonly logger = new Logger(CreateExerciseService.name);

  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to create exercise', 'Library Exercise')
  async createExercise(
    data: CreateLibraryExerciseDto,
  ): Promise<TResponse<any>> {
    this.logger.log(
      `Creating exercise for library ${data.workoutId} with data`,
      data,
    );

    const workoutId = data.workoutId;

    // validate workout id by fetching the details along with full exercise video url

    return successResponse(null, 'Library Exercise created successfully');
  }
}
