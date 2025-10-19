import { Module } from '@nestjs/common';
import { ProgramModule } from './program/program.module';
import { ProgressModule } from './progress/progress.module';
import { UserModule } from './user/user.module';
import { LibraryModule } from './library/library.module';

@Module({
  imports: [UserModule, ProgramModule, ProgressModule, LibraryModule],
  controllers: [],
})
export class AdminModule {}
