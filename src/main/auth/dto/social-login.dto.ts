import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class FacebookLoginDto {
  @ApiProperty({
    description: 'Access token from the social login provider',
    example: 'token',
  })
  @IsString()
  accessToken: string;
}

export class SocialLoginDto {
  @ApiProperty({ enum: AuthProvider, example: AuthProvider.FACEBOOK })
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @ApiProperty({
    description: 'Access token from the social login provider',
    example: 'token',
  })
  @IsString()
  accessToken: string;

  @ApiProperty({ example: 'user@example' })
  @IsString()
  email: string;
}

export class VerifySocialProviderOtpDto {
  @ApiProperty({ description: 'User email to verify OTP' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'OTP sent to user email' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ description: 'Auth provider to link', enum: AuthProvider })
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @ApiProperty({ description: 'Provider ID from the social login' })
  @IsString()
  @IsNotEmpty()
  providerId: string;
}
