import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FacebookLoginDto, TwitterLoginDto } from '../dto/social-login.dto';
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

  @ApiOperation({ summary: 'Twitter login Request' })
  @Get('request-token')
  async requestTwitterLogin() {
    return this.authSocialService.requestTwitterLogin();
  }

  @ApiOperation({ summary: 'Twitter login' })
  @Post('twitter-login')
  async twitterLogin(@Body() body: TwitterLoginDto) {
    return this.authSocialService.twitterLogin(body);
  }
}
