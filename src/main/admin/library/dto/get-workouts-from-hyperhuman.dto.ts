import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { Difficulty } from '@project/lib/hyperhuman/types/workout.types';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetWorkoutsFromHyperhumanDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'My Workout',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: Difficulty.BEGINNER,
    enum: Difficulty,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'beginner') return Difficulty.BEGINNER;
      if (value === 'intermediate') return Difficulty.INTERMEDIATE;
      if (value === 'advanced') return Difficulty.ADVANCED;
      return undefined;
    }
    return undefined;
  })
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}
