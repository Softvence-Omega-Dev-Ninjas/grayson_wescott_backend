import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({
    description:
      'Timezone of the user in IANA format (e.g., "America/New_York")',
    example: 'Asia/Dhaka',
    default: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone: string;

  @ApiPropertyOptional({
    description: 'Whether the user allows direct messages from others',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean()
  allowDirectMessages?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user allows receiving messages via email',
    example: true,
    default: true,
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsOptional()
  @IsBoolean()
  allowEmailMessages?: boolean;
}
