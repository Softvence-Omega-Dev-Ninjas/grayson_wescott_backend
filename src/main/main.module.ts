import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [SharedModule, AdminModule, UserModule],
  controllers: [],
  providers: [],
})
export class MainModule {}
