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

export class ProgramUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}

export class AddProgramDto {
  @ApiProperty({ example: 'My Program' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'This is my program' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: [ExerciseCategory.CARDIO, ExerciseCategory.STRENGTH],
    enum: ExerciseCategory,
  })
  @IsArray()
  @IsEnum(ExerciseCategory, { each: true })
  categories: ExerciseCategory[];

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
    description: 'List of user UUIDs to attach to this program',
  })
  @IsArray()
  @ArrayNotEmpty()
  userIds!: string[];
}
