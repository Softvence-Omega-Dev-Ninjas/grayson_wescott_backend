import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UtilsService } from '@project/lib/utils/utils.service';


@Module({
  controllers: [],
  providers: [, UtilsService, JwtService, ],
})
export class AuthModule {}
