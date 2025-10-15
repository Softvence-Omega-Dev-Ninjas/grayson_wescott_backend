import { Module } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { AuthController } from './controllers/auth.controller';
import { AuthGetProfileService } from './services/auth-get-profile.service';
import { AuthGoogleService } from './services/auth-google.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthLogoutService } from './services/auth-logout.service';
import { AuthOtpService } from './services/auth-otp.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthRegisterService } from './services/auth-register.service';
import { AuthTfaService } from './services/auth-tfa.service';
import { UpdateProfileService } from './services/update-profile.service';
import { AuthSocialController } from './controllers/auth-social.controller';
import { AuthSocialService } from './services/auth-social.service';

@Module({
  controllers: [AuthController, AuthSocialController],
  providers: [
    S3Service,
    AuthRegisterService,
    AuthGoogleService,
    AuthLoginService,
    AuthOtpService,
    AuthPasswordService,
    AuthLogoutService,
    AuthTfaService,
    AuthGetProfileService,
    UpdateProfileService,
    AuthSocialService,
  ],
})
export class AuthModule {}
