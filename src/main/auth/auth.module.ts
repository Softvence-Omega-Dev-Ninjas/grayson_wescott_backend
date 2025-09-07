import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthFacebookService } from './services/auth-facebook.service';
import { AuthGoogleService } from './services/auth-google.service';
import { AuthRegisterService } from './services/auth-register.service';
import { AuthLoginService } from './services/auth-login.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthRegisterService,
    AuthGoogleService,
    AuthFacebookService,
    AuthLoginService,
  ],
})
export class AuthModule {}
