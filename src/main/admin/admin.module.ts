import { Module } from '@nestjs/common';
import { ProgramModule } from './program/program.module';
import { ProgressModule } from './progress/progress.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [UserModule, ProgramModule, ProgressModule],
  controllers: [],
})
export class AdminModule {}
