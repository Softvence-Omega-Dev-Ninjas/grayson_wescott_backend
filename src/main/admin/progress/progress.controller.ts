import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { ProgressStatsService } from './services/progress-stats.service';

@ApiTags('Admin --- Progress Tracking')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressStatsService: ProgressStatsService) {}

  @ApiOperation({ summary: 'Get progress stats' })
  @Get('stats')
  async getStats(@GetUser('sub') adminId: string) {
    return this.progressStatsService.getProgressStats(adminId);
  }
}
