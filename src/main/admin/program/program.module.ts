import { Module } from '@nestjs/common';
import { ProgramController } from './controllers/program.controller';
import { AddProgramService } from './services/add-program.service';
import { UpdateProgramService } from './services/update-program.service';
import { ProgramService } from './services/program.service';
import { CategoriesService } from './services/categories.service';

@Module({
  controllers: [ProgramController],
  providers: [
    AddProgramService,
    UpdateProgramService,
    ProgramService,
    CategoriesService,
  ],
})
export class ProgramModule {}
