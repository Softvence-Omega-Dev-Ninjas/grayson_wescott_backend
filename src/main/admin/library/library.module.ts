import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { CreateExerciseService } from './services/create-exercise.service';

@Module({
  controllers: [LibraryController],
  providers: [CreateExerciseService],
})
export class LibraryModule {}
