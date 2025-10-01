import { Module } from '@nestjs/common';
import { ProgramService } from './services/program.service';
import { ProgramController } from './controllers/program.controller';

@Module({
  controllers: [ProgramController],
  providers: [ProgramService],
})
export class ProgramModule {}
