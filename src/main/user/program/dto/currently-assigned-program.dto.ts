import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramProgress } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class CurrentlyAssignedProgramDto extends PaginationDto {
  @ApiPropertyOptional({
    example: ProgramProgress.IN_PROGRESS,
    enum: ProgramProgress,
  })
  @IsOptional()
  @IsEnum(ProgramProgress)
  status: ProgramProgress;
}
