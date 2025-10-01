import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
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
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsUUID()
  programId: string;

  @ApiPropertyOptional({ example: 'Updated Program Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description of program' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: [ExerciseCategory.CARDIO, ExerciseCategory.STRENGTH],
    enum: ExerciseCategory,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ExerciseCategory, { each: true })
  categories?: ExerciseCategory[];

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
    description: 'List of user UUIDs to attach to this program',
  })
  @IsOptional()
  @IsArray()
  userIds?: string[];
}
