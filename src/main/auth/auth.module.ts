import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthFacebookService } from './services/auth-facebook.service';
import { AuthGoogleService } from './services/auth-google.service';
import { AuthService } from './services/auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGoogleService, AuthFacebookService],
})
export class AuthModule {}
