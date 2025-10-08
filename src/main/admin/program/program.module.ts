import { Module } from '@nestjs/common';
import { GetAllProgramService } from '@project/main/user/program/services/get-all-program.service';
import { CategoriesController } from './controllers/categories.controller';
import { ClientAnalyticsController } from './controllers/client-analytics.controller';
import { ProgramController } from './controllers/program.controller';
import { AddProgramService } from './services/add-program.service';
import { CategoriesService } from './services/categories.service';
import { ClientAnalyticsService } from './services/client-analytics.service';
import { ProgramService } from './services/program.service';
import { SingleClientAnalyticsService } from './services/single-client-analytics.service';
import { UpdateProgramService } from './services/update-program.service';

@Module({
  controllers: [
    CategoriesController,
    ProgramController,
    ClientAnalyticsController,
  ],
  providers: [
    AddProgramService,
    UpdateProgramService,
    ProgramService,
    CategoriesService,
    ClientAnalyticsService,
    SingleClientAnalyticsService,
    GetAllProgramService,
  ],
})
export class ProgramModule {}
