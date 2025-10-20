import { Module } from '@nestjs/common';
import { ProgramModule } from './program/program.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [ProgramModule, DashboardModule],
})
export class UserModule {}
