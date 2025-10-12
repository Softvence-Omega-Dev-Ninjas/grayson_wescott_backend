import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramProgress } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export class CurrentlyAssignedProgramDto extends PaginationDto {
  @ApiPropertyOptional({
    example: ProgramProgress.IN_PROGRESS,
    enum: ProgramProgress,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'IN_PROGRESS') return ProgramProgress.IN_PROGRESS;
      if (value === 'PAUSED') return ProgramProgress.PAUSED;
      if (value === 'COMPLETED') return ProgramProgress.COMPLETED;
      return undefined;
    }
    return undefined;
  })
  @IsEnum(ProgramProgress)
  status?: ProgramProgress;
}
