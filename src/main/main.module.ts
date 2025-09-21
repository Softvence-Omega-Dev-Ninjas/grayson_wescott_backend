import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { S3BucketModule } from './s3/s3.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [AuthModule, SharedModule, S3BucketModule, AdminModule, UserModule],
  controllers: [],
  providers: [],
})
export class MainModule {}
