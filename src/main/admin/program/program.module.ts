import { Module } from '@nestjs/common';
import { ProgramController } from './controllers/program.controller';
import { AddProgramService } from './services/add-program.service';

@Module({
  controllers: [ProgramController],
  providers: [AddProgramService],
})
export class ProgramModule {}
