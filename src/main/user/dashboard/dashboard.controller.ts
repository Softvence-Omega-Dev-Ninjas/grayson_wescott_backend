import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { DashboardStatsService } from './services/dashboard-stats.service';

@ApiTags('Client --- Dashboard & Exercises Library')
@ApiBearerAuth()
@ValidateAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardStatsService: DashboardStatsService) {}

  @ApiOperation({ summary: 'Get dashboard stats' })
  @Get()
  async getDashboardStats(@GetUser('sub') userId: string) {
    return this.dashboardStatsService.getDashboardStats(userId);
  }
}
