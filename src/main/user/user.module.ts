import { Module } from '@nestjs/common';
import { ProgramModule } from './program/program.module';

@Module({
  imports: [ProgramModule]
})
export class UserModule {}
