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

    const response = await this.hyperhuman.getURLsByWorkOutId(workoutId);

    this.logger.log(`Workout Response for Hyperhuman`, response.videoData);

    const libraryExercise = await this.prisma.libraryExercise.create({
      data: {
        ...data,
        videoUrl: response.videoData.videoUrl,
        videoUrlExpiresAt: response.videoData.videoUrlExpiresAt,
        previewUrl: response.videoData.previewUrl,
        previewUrlExpiresAt: response.videoData.previewUrlExpiresAt,
        thumbnailUrl: response.videoData.thumbnailUrl,
        thumbnailUrlExpiresAt: response.videoData.thumbnailUrlExpiresAt,
        // hyperhumanData: response.hyperhumanData, // TODO: Add this if needed
      },
    });

    return successResponse(
      libraryExercise,
      'Library Exercise created successfully',
    );
  }
}
