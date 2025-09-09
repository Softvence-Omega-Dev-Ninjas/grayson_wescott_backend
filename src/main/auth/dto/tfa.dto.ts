import { ApiProperty } from '@nestjs/swagger';
import { TwoFAMethod } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class RequestTFA {
  @ApiProperty({ enum: TwoFAMethod, example: 'EMAIL', description: 'Method' })
  @IsEnum(TwoFAMethod)
  method: TwoFAMethod;
}
