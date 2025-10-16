import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FacebookLoginDto,
  SocialLoginDto,
  VerifySocialProviderOtpDto,
} from '../dto/social-login.dto';
import { AuthSocialService } from '../services/auth-social.service';

@ApiTags('Auth Social')
@Controller('auth-social')
export class AuthSocialController {
  constructor(private readonly authSocialService: AuthSocialService) {}

  @ApiOperation({ summary: 'Facebook login' })
  @Post('facebook-login')
  async facebookLogin(@Body() body: FacebookLoginDto) {
    return this.authSocialService.facebookLogin(body);
  }

  @ApiOperation({ summary: 'Social login' })
  @Post('social-login')
  async socialLogin(@Body() body: SocialLoginDto) {
    return this.authSocialService.socialLogin(body);
  }

  @ApiOperation({ summary: 'Social login OTP verification' })
  @Post('verify-login')
  async verifySocialProviderOtp(@Body() body: VerifySocialProviderOtpDto) {
    return this.authSocialService.verifySocialProviderOtp(body);
  }
}
