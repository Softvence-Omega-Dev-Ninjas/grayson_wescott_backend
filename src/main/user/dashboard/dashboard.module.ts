import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardStatsService } from './services/dashboard-stats.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardStatsService],
})
export class DashboardModule {}
