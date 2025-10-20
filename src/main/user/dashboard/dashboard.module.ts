import { Module } from '@nestjs/common';
import { GetLibraryExerciseService } from '@project/main/admin/library/services/get-library-exercise.service';
import { DashboardController } from './dashboard.controller';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { ExerciseLibraryService } from './services/exercise-library.service';
import { GetNotificationService } from './services/get-notification.service';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardStatsService,
    ExerciseLibraryService,
    GetLibraryExerciseService,
    GetNotificationService,
  ],
})
export class DashboardModule {}
