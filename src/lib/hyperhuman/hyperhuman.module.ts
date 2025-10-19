import { Global, Module } from '@nestjs/common';
import { HyperhumanService } from './hyperhuman.service';

@Global()
@Module({
  providers: [HyperhumanService],
  exports: [HyperhumanService],
})
export class HyperhumanModule {}
