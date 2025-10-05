import { Controller } from '@nestjs/common';
import { ProgressStatsService } from './services/progress-stats.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressStatsService: ProgressStatsService) {}
}
