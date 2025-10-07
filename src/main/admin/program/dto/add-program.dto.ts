import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProgramExerciseDto } from './program-exercise.dto';

export class AddProgramDto {
  @ApiProperty({ example: 'My Program' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'This is my program' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'This is my coach note' })
  @IsOptional()
  @IsString()
  coachNote?: string;

  @ApiProperty({
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '123e4567-e89b-12d3-a456-426614174000',
    ],
    description: 'List of category UUIDs',
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  categories: string[];

  @ApiProperty({ example: 8, description: 'Duration in weeks' })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  duration: number;

  @ApiProperty({
    type: [CreateProgramExerciseDto],
    example: [
      {
        title: 'My Exercise',
        description: 'This is my exercise',
        dayOfWeek: 'MONDAY',
        order: 1,
        duration: 30,
        restSeconds: 10,
        reps: 10,
        sets: 3,
        tempo: 'EASY',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateProgramExerciseDto)
  exercises!: CreateProgramExerciseDto[];

  @ApiProperty({
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '123e4567-e89b-12d3-a456-426614174000',
    ],
    description: 'Optional: list of user UUIDs to auto-assign to the program',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  userIds: string[];
}

export class AssignUsersToProgramDto {
  @ApiProperty({
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '123e4567-e89b-12d3-a456-426614174000',
    ],
    description: 'List of user UUIDs to attach to this program',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  userIds: string[];

  @ApiPropertyOptional({ example: '2022-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;
}
