import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';

@Global()
@Module({
  providers: [NotificationGateway, JwtService],
  controllers: [],
  exports: [NotificationGateway],
})
export class NotificationModule {}
