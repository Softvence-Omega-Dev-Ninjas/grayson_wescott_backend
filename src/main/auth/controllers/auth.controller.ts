import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthFacebookService } from '../services/auth-facebook.service';
import { AuthGoogleService } from '../services/auth-google.service';
import { AuthService } from '../services/auth.service';
import { FacebookLoginDto } from '../dto/facebook-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authGoogleService: AuthGoogleService,
    private readonly authFacebookService: AuthFacebookService,
  ) {}

  @ApiOperation({ summary: 'User Registration with Email' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @ApiOperation({ summary: 'User Login with Email' })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
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
