import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetProgramsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by program name',
    example: 'My Program',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by category UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  category?: string;

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
