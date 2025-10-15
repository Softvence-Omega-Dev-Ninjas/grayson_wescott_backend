import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SocialLoginCompleteDto,
  SocialLoginDto,
  VerifySocialProviderOtpDto,
} from '../dto/social-login.dto';
import { AuthSocialService } from '../services/auth-social.service';

@ApiTags('Auth Social')
@Controller('auth-social')
export class AuthSocialController {
  constructor(private readonly authSocialService: AuthSocialService) {}

  @ApiOperation({ summary: 'Social login init' })
  @Post('init-login')
  async socialLogin(@Body() body: SocialLoginDto) {
    return this.authSocialService.socialLogin(body);
  }

  @ApiOperation({ summary: 'Social login complete' })
  @Post('complete-login')
  async socialLoginComplete(@Body() body: SocialLoginCompleteDto) {
    return this.authSocialService.socialLoginComplete(body);
  }

  @ApiOperation({ summary: 'Social login OTP verification' })
  @Post('verify-login')
  async verifySocialProviderOtp(@Body() body: VerifySocialProviderOtpDto) {
    return this.authSocialService.verifySocialProviderOtp(body);
  }
}
