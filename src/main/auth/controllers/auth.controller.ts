import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FacebookLoginDto } from '../dto/facebook-login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { RegisterDto, VerifyEmailDto } from '../dto/register.dto';
import { AuthFacebookService } from '../services/auth-facebook.service';
import { AuthGoogleService } from '../services/auth-google.service';
import { AuthRegisterService } from '../services/auth-register.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authRegisterService: AuthRegisterService,
    private readonly authGoogleService: AuthGoogleService,
    private readonly authFacebookService: AuthFacebookService,
  ) {}

  @ApiOperation({ summary: 'User Registration with Email' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authRegisterService.register(body);
  }

  @ApiOperation({ summary: 'Verify User Email after Email Registration' })
  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authRegisterService.verifyEmail(body.email, body.otp);
  }

  @ApiOperation({ summary: 'Google Login or Sign Up' })
  @Post('google-login')
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authGoogleService.googleLogin(body);
  }

  @ApiOperation({ summary: 'Facebook Login or Sign Up' })
  @Post('facebook-login')
  async facebookLogin(@Body() body: FacebookLoginDto) {
    return this.authFacebookService.facebookLogin(body);
  }
}
