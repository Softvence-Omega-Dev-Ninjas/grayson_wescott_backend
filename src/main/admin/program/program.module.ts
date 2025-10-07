import { Module } from '@nestjs/common';
import { CategoriesController } from './controllers/categories.controller';
import { ProgramController } from './controllers/program.controller';
import { AddProgramService } from './services/add-program.service';
import { CategoriesService } from './services/categories.service';
import { ProgramService } from './services/program.service';
import { UpdateProgramService } from './services/update-program.service';

@Module({
  controllers: [CategoriesController, ProgramController],
  providers: [
    AddProgramService,
    UpdateProgramService,
    ProgramService,
    CategoriesService,
  ],
})
export class ProgramModule {}
