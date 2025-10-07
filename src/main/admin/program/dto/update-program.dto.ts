import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateProgramExerciseDto } from './program-exercise.dto';

export class UpdateProgramExerciseDto extends CreateProgramExerciseDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  id?: string; // Optional, used to update existing exercise
}

export class UpdateProgramDto {
  @ApiPropertyOptional({ example: 'Updated Program Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description of program' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '123e4567-e89b-12d3-a456-426614174000',
    ],
    description: 'Category UUID',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categories?: string[];

  @ApiPropertyOptional({ example: 'This is my program' })
  @IsOptional()
  @IsString()
  coachNote?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  duration?: number;

  @ApiPropertyOptional({ example: ProgramStatus.ARCHIVED })
  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;

  @ApiPropertyOptional({
    type: [UpdateProgramExerciseDto],
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Updated Exercise',
        dayOfWeek: 'MONDAY',
        order: 1,
      },
      {
        title: 'New Exercise',
        dayOfWeek: 'TUESDAY',
        order: 2,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UpdateProgramExerciseDto)
  exercises?: UpdateProgramExerciseDto[];

  @ApiPropertyOptional({
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '123e4567-e89b-12d3-a456-426614174000',
    ],
    description: 'Optional: list of user UUIDs to auto-assign to the program',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  userIds?: string[];
}
