import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import {
  FacebookLoginCompleteDto,
  FacebookLoginDto,
} from '../dto/facebook-login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendOtpDto, VerifyOTPDto } from '../dto/otp.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/password.dto';
import { VerifySocialProviderOtpDto } from '../dto/provider.dto';
import { RegisterDto } from '../dto/register.dto';
import { SetPhoneDto } from '../dto/set-phone.dto';
import { RequestTFA } from '../dto/tfa.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateUserPreferencesDto } from '../dto/update-user-preferences.dto';
import { VerifyTfaDto } from '../dto/verify-tfa.dto';
import { AuthFacebookService } from '../services/auth-facebook.service';
import { AuthGetProfileService } from '../services/auth-get-profile.service';
import { AuthGoogleService } from '../services/auth-google.service';
import { AuthLoginService } from '../services/auth-login.service';
import { AuthOtpService } from '../services/auth-otp.service';
import { AuthPasswordService } from '../services/auth-password.service';
import { AuthRegisterService } from '../services/auth-register.service';
import { AuthTfaService } from '../services/auth-tfa.service';
import { UpdateProfileService } from '../services/update-profile.service';
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
    private readonly updateProfileService: UpdateProfileService,
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
  async logOut(@GetUser('sub') userId: string) {
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
  async requestTFA(@GetUser('sub') userId: string, @Body() body: RequestTFA) {
    return this.authTfaService.requestToEnableTfa(userId, body.method);
  }

  @ApiOperation({ summary: 'Verify TFA' })
  @ApiBearerAuth()
  @Post('verify-tfa')
  @ValidateAuth()
  async verifyTfaSetup(
    @GetUser('sub') userId: string,
    @Body() body: VerifyTfaDto,
  ) {
    return this.authTfaService.verifyTfaSetup(userId, body);
  }

  @ApiOperation({ summary: 'Disable TFA' })
  @ApiBearerAuth()
  @Post('disable-tfa')
  @ValidateAuth()
  async disableTfa(@GetUser('sub') userId: string) {
    return this.authTfaService.disableTfa(userId);
  }

  @ApiOperation({ summary: 'Change Password' })
  @ApiBearerAuth()
  @Post('change-password')
  @ValidateAuth()
  async changePassword(
    @GetUser('sub') userId: string,
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

  @ApiOperation({ summary: 'Facebook Login Complete' })
  @Post('facebook-login-complete')
  async facebookLoginComplete(@Body() body: FacebookLoginCompleteDto) {
    return this.authFacebookService.facebookLoginComplete(body);
  }

  @ApiOperation({ summary: 'Verify Social Provider OTP' })
  @Post('verify-social-provider-otp')
  async verifySocialProviderOtp(@Body() body: VerifySocialProviderOtpDto) {
    return this.authFacebookService.verifySocialProviderOtp(body);
  }

  @ApiOperation({ summary: 'Get User Profile' })
  @ApiBearerAuth()
  @Get('profile')
  @ValidateAuth()
  async getProfile(@GetUser('sub') userId: string) {
    return this.authGetProfileService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Update User Preferences' })
  @ApiBearerAuth()
  @Post('update-preferences')
  @ValidateAuth()
  async updatePreferences(
    @GetUser('sub') userId: string,
    @Body() body: UpdateUserPreferencesDto,
  ) {
    return this.updateProfileService.manageUserPreferences(userId, body);
  }

  @ApiOperation({ summary: 'Set Phone Number' })
  @ApiBearerAuth()
  @Post('set-phone-number')
  @ValidateAuth()
  async setPhoneNumber(
    @GetUser('sub') userId: string,
    @Body() body: SetPhoneDto,
  ) {
    return this.updateProfileService.setPhoneNumber(userId, body.phone);
  }

  @ApiOperation({ summary: 'Update profile' })
  @ApiBearerAuth()
  @Patch(':id')
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB Max
      fileFilter: (req, file, callback) => {
        // Accept only image mimetype
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  update(
    @GetUser('sub') id: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.updateProfileService.updateProfile(id, dto, file);
  }
}
