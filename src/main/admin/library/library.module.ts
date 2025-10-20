import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { CreateExerciseService } from './services/create-exercise.service';
import { GetLibraryExerciseService } from './services/get-library-exercise.service';

@Module({
  controllers: [LibraryController],
  providers: [CreateExerciseService, GetLibraryExerciseService],
})
export class LibraryModule {}
