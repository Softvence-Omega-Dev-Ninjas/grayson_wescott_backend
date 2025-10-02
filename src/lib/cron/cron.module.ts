import { Module } from '@nestjs/common';
import { DailyExerciseService } from './services/daily-exercise.service';

@Module({
  providers: [DailyExerciseService],
})
export class CronModule {}
