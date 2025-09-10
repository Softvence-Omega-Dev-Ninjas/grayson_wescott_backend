import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { FacebookLoginDto } from '../dto/facebook-login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendOtpDto, VerifyOTPDto } from '../dto/otp.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/password.dto';
import { RegisterDto } from '../dto/register.dto';
import { RequestTFA } from '../dto/tfa.dto';
import { VerifyTfaDto } from '../dto/verify-tfa.dto';
import { AuthFacebookService } from '../services/auth-facebook.service';
import { AuthGetProfileService } from '../services/auth-get-profile.service';
import { AuthGoogleService } from '../services/auth-google.service';
import { AuthLoginService } from '../services/auth-login.service';
import { AuthOtpService } from '../services/auth-otp.service';
import { AuthPasswordService } from '../services/auth-password.service';
import { AuthRegisterService } from '../services/auth-register.service';
import { AuthTfaService } from '../services/auth-tfa.service';
import { AuthLogoutService } from './../services/auth-logout.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authRegisterService: AuthRegisterService,
    private readonly authGoogleService: AuthGoogleService,
    private readonly authFacebookService: AuthFacebookService,
    private readonly authLoginService: AuthLoginService,
    private readonly authLogoutService: AuthLogoutService,
    private readonly authOtpService: AuthOtpService,
    private readonly authPasswordService: AuthPasswordService,

    private readonly authTfaService: AuthTfaService,
    private readonly authGetProfileService: AuthGetProfileService,
  ) {}

  @ApiOperation({ summary: 'User Registration with Email' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authRegisterService.register(body);
  }

  @ApiOperation({ summary: 'User Login' })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authLoginService.login(body);
  }

  @ApiOperation({ summary: 'User Logout' })
  @ApiBearerAuth()
  @Post('logout')
  @ValidateAuth()
  async logOut(@GetUser('userId') userId: string) {
    return this.authLogoutService.logout(userId);
  }

  @ApiOperation({ summary: 'Resend OTP to Email' })
  @Post('resend-otp')
  async resendOtp(@Body() body: ResendOtpDto) {
    return this.authOtpService.resendOtp(body.email);
  }

  @ApiOperation({ summary: 'Verify OTP after Registration or Login or TFA' })
  @Post('verify-otp')
  async verifyEmail(@Body() body: VerifyOTPDto) {
    return this.authOtpService.verifyOTP(body);
  }

  @ApiOperation({ summary: 'Request TFA' })
  @ApiBearerAuth()
  @Post('request-tfa')
  @ValidateAuth()
  async requestTFA(
    @GetUser('userId') userId: string,
    @Body() body: RequestTFA,
  ) {
    return this.authTfaService.requestToEnableTfa(userId, body.method);
  }

  @ApiOperation({ summary: 'Verify TFA' })
  @ApiBearerAuth()
  @Post('verify-tfa')
  @ValidateAuth()
  async verifyTfaSetup(
    @GetUser('userId') userId: string,
    @Body() body: VerifyTfaDto,
  ) {
    return this.authTfaService.verifyTfaSetup(userId, body);
  }

  @ApiOperation({ summary: 'Disable TFA' })
  @ApiBearerAuth()
  @Post('disable-tfa')
  @ValidateAuth()
  async disableTfa(@GetUser('userId') userId: string) {
    return this.authTfaService.disableTfa(userId);
  }

  @ApiOperation({ summary: 'Change Password' })
  @ApiBearerAuth()
  @Post('change-password')
  @ValidateAuth()
  async changePassword(
    @GetUser('userId') userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authPasswordService.changePassword(userId, body);
  }

  @ApiOperation({ summary: 'Forgot Password - Send Reset Email' })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authPasswordService.forgotPassword(body.email);
  }

  @ApiOperation({ summary: 'Reset Password' })
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authPasswordService.resetPassword(body);
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

  @ApiOperation({ summary: 'Get User Profile' })
  @ApiBearerAuth()
  @Get('profile')
  @ValidateAuth()
  async getProfile(@GetUser('userId') userId: string) {
    return this.authGetProfileService.getProfile(userId);
  }
}
