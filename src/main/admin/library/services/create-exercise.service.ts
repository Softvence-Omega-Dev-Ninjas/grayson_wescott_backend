import { Injectable, Logger } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { HyperhumanService } from '@project/lib/hyperhuman/hyperhuman.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { CreateLibraryExerciseDto } from '../dto/create-library-exercise.dto';

@Injectable()
export class CreateExerciseService {
  private readonly logger = new Logger(CreateExerciseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hyperhuman: HyperhumanService,
  ) {}

  @HandleError('Failed to create exercise', 'Library Exercise')
  async createExercise(
    data: CreateLibraryExerciseDto,
  ): Promise<TResponse<any>> {
    const workoutId = data.workoutId;

    const urls = await this.hyperhuman.getURLsByWorkOutId(workoutId);

    this.logger.log(`Got URLs for workout ${workoutId} from hyperhuman:`, urls);

    return successResponse(null, 'Library Exercise created successfully');
  }
}
