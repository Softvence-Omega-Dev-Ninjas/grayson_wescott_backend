import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyOTPDto {
  @ApiProperty({
    example: '123456',
    description: 'OTP code',
  })
  @IsNotEmpty()
  otp: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Phone number',
  })
  @IsNotEmpty()
  phone?: string;
}
