import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressStatsService } from './services/progress-stats.service';

@Module({
  controllers: [ProgressController],
  providers: [ProgressStatsService],
})
export class ProgressModule {}
