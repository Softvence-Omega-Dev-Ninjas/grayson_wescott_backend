import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { HyperhumanService } from '@project/lib/hyperhuman/hyperhuman.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { GetLibraryExerciseDto } from '../dto/get-library-exercise.dto';

@Injectable()
export class GetLibraryExerciseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hyperhuman: HyperhumanService,
  ) {}

  @HandleError('Failed to get library exercise', 'LibraryExercise')
  async getExerciseLibrary(
    dto: GetLibraryExerciseDto,
  ): Promise<TPaginatedResponse<any>> {
    const page = dto.page && +dto.page > 0 ? +dto.page : 1;
    const limit = dto.limit && +dto.limit > 0 ? +dto.limit : 10;

    const skip = (page - 1) * limit;

    const search = dto.search?.trim();

    const where: Prisma.LibraryExerciseWhereInput = {};

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [exercises, total] = await this.prisma.$transaction([
      this.prisma.libraryExercise.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.libraryExercise.count({ where }),
    ]);

    return successPaginatedResponse(
      exercises,
      {
        page,
        limit,
        total,
      },
      'Library exercises fetched successfully',
    );
  }

  @HandleError('Failed to get single library exercise', 'LibraryExercise')
  async getSingleExercise(id: string): Promise<TResponse<any>> {
    const exercise = await this.prisma.libraryExercise.findUniqueOrThrow({
      where: { id },
    });

    const isPreviewExpired = this.isExpired(exercise.previewUrlExpiresAt);
    const isThumbnailExpired = this.isExpired(exercise.thumbnailUrlExpiresAt);
    const isVideoExpired = this.isExpired(exercise.videoUrlExpiresAt);

    if (isPreviewExpired || isThumbnailExpired || isVideoExpired) {
      const updated = await this.refreshExerciseUrls(exercise);
      return successResponse(
        updated,
        'Library exercise fetched successfully (urls refreshed)',
      );
    }

    return successResponse(exercise, 'Library exercise fetched successfully');
  }

  private isExpired(expireDate?: Date | null): boolean {
    if (!expireDate) return true;
    return new Date(expireDate).getTime() < Date.now();
  }

  private async refreshExerciseUrls(exercise: any) {
    const response = await this.hyperhuman.getURLsByWorkOutId(
      exercise.workoutId,
    );

    const updated = await this.prisma.libraryExercise.update({
      where: { id: exercise.id },
      data: {
        videoUrl: response.videoData.videoUrl,
        videoUrlExpiresAt: response.videoData.videoUrlExpiresAt,
        previewUrl: response.videoData.previewUrl,
        previewUrlExpiresAt: response.videoData.previewUrlExpiresAt,
        thumbnailUrl: response.videoData.thumbnailUrl,
        thumbnailUrlExpiresAt: response.videoData.thumbnailUrlExpiresAt,
      },
    });

    return updated;
  }
}
