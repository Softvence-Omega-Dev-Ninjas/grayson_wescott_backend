import { Global, Module } from '@nestjs/common';
import { GatewayGateway } from './gateway.gateway';

@Global()
@Module({
  providers: [GatewayGateway],
  exports: [GatewayGateway],
})
export class GatewayModule {}
