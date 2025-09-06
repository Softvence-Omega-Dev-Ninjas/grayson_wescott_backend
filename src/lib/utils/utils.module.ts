import { Global, Module } from '@nestjs/common';
import { UtilsService } from './utils.service';
import { JwtService } from '@nestjs/jwt';

@Global()
@Module({
  providers: [UtilsService, JwtService],
  exports: [UtilsService],
})
export class UtilsModule {}
