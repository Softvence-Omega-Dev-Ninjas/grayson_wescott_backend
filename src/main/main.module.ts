import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SharedModule } from './shared/shared.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [SharedModule, AuthModule, AdminModule, UserModule],
  controllers: [],
  providers: [],
})
export class MainModule {}
