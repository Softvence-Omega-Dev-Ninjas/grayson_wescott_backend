import { ApiProperty } from '@nestjs/swagger';
import { TwoFAMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class VerifyTfaDto {
  @ApiProperty({
    example: '123456',
    description: 'OTP code',
  })
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ enum: TwoFAMethod, example: 'EMAIL', description: 'Method' })
  @IsEnum(TwoFAMethod)
  method: TwoFAMethod;
}
