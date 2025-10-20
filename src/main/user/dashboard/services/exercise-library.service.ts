import { Injectable, Logger } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { TResponse } from '@project/common/utils/response.util';
import { GetLibraryExerciseDto } from '@project/main/admin/library/dto/get-library-exercise.dto';
import { GetLibraryExerciseService } from '@project/main/admin/library/services/get-library-exercise.service';

@Injectable()
export class ExerciseLibraryService {
  private readonly logger = new Logger(ExerciseLibraryService.name);

  constructor(
    private readonly getLibraryExerciseService: GetLibraryExerciseService,
  ) {}

  @HandleError('Failed to get library exercises', 'LibraryExercise')
  async getLibraryExercises(userId: string, query: GetLibraryExerciseDto) {
    // TODO: send only exercises that user has access to
    this.logger.log(`Getting library exercises for user ${userId}`);

    return this.getLibraryExerciseService.getExerciseLibrary(query);
  }

  @HandleError('Failed to get single library exercise', 'LibraryExercise')
  async getSingleExerciseFromLibrary(
    userId: string,
    id: string,
  ): Promise<TResponse<any>> {
    // TODO : first validate if user has access to this exercise
    this.logger.log(`Getting single library exercise for user ${userId}`);

    return this.getLibraryExerciseService.getSingleExercise(id);
  }
}
