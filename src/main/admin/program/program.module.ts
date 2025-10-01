import { Module } from '@nestjs/common';
import { ProgramController } from './controllers/program.controller';
import { AddProgramService } from './services/add-program.service';
import { UpdateProgramService } from './services/update-program.service';

@Module({
  controllers: [ProgramController],
  providers: [AddProgramService, UpdateProgramService],
})
export class ProgramModule {}
