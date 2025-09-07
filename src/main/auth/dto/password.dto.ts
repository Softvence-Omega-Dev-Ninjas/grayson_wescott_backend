import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({ example: 'strongPassword123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  newPassword: string;
}
