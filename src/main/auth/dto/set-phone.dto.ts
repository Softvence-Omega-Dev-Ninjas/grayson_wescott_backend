import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SetPhoneDto {
  @ApiProperty({
    description: 'Phone number in E.164 format (e.g., +1234567890)',
    example: '+1234567890',
  })
  @IsNotEmpty()
  @IsString()
  phone: string;
}
