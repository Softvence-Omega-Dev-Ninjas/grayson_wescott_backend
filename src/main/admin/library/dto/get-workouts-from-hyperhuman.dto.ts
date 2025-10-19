import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

enum difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export class GetWorkoutsFromHyperhumanDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'My Workout',
  })
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    example: 'Beginner',
    enum: difficulty,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'beginner') return difficulty.BEGINNER;
      if (value === 'intermediate') return difficulty.INTERMEDIATE;
      if (value === 'advanced') return difficulty.ADVANCED;
      return undefined;
    }
    return undefined;
  })
  @IsEnum(difficulty)
  difficulty?: difficulty;
}
