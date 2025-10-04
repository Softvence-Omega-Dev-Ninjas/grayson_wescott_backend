import { Module } from '@nestjs/common';
import { ProgramService } from './services/program.service';
import { ProgramController } from './controllers/program.controller';
import { ManageDailyProgramService } from './services/manage-daily-program.service';

@Module({
  controllers: [ProgramController],
  providers: [ProgramService, ManageDailyProgramService],
})
export class ProgramModule {}
