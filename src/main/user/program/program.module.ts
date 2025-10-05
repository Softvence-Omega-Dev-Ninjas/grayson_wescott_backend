import { Module } from '@nestjs/common';
import { ProgramController } from './controllers/program.controller';
import { GetAProgramService } from './services/get-a-program.service';
import { GetAllProgramService } from './services/get-all-program.service';
import { ManageDailyProgramService } from './services/manage-daily-program.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { WorkUtHistoryService } from './services/workout-history.service';

@Module({
  controllers: [ProgramController],
  providers: [
    GetAProgramService,
    ManageDailyProgramService,
    GetAllProgramService,
    ProgressTrackingService,
    WorkUtHistoryService,
  ],
})
export class ProgramModule {}
