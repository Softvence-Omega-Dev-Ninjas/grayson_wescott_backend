import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ProgramModule } from './program/program.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [UserModule, ProgramModule, ProgressModule],
})
export class AdminModule {}
