import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramProgress, UserStatus } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

export class GetAllClientsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: UserStatus.ACTIVE,
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class SingleClientAnalyticsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    example: ProgramProgress.IN_PROGRESS,
    enum: ProgramProgress,
  })
  @IsOptional()
  @IsEnum(ProgramProgress)
  status?: ProgramProgress;

  @ApiPropertyOptional({
    description: 'Date of daily log in ISO',
    example: '2024-10-28T15:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  dailyLogDate?: string;

  @ApiPropertyOptional({
    description: 'Date of week start in ISO',
    example: '2024-10-28T15:30:00.000Z',
  })
  weekStart?: string;

  @ApiPropertyOptional({
    description: 'Date of week end in ISO',
    example: '2024-10-28T15:30:00.000Z',
  })
  weekEnd?: string;
}
