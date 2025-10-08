import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateProgramExerciseDto {
  @ApiProperty({ example: 'My Exercise' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'This is my exercise' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: DayOfWeek.MONDAY,
    enum: DayOfWeek,
  })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  restSeconds?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  reps?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  sets?: number;

  @ApiPropertyOptional({ example: 'This is my tempo' })
  @IsOptional()
  @IsString()
  tempo?: string;

  @ApiPropertyOptional({ example: 'https://example.com/video.mp4' })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}
