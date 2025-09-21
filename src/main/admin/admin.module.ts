import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ProgramModule } from './program/program.module';

@Module({
  imports: [UserModule, ProgramModule],
})
export class AdminModule {}
