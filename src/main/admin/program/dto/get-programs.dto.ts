import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseCategory, ProgramStatus } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class GetProgramsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by program name',
    example: 'My Program',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by exercise categories',
    isArray: true,
    enum: ExerciseCategory,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ExerciseCategory, { each: true })
  categories?: ExerciseCategory[];

  @ApiPropertyOptional({
    description: 'Filter by assigned user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by program status',
    enum: ProgramStatus,
  })
  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;
}
