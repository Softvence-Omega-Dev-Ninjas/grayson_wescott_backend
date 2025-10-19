import { ApiProperty } from '@nestjs/swagger';
import { BodyPart, DifficultyLevel, Equipment } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateLibraryExerciseDto {
  // From Hyperhuman
  @ApiProperty({
    description: 'Hyperhuman workout ID',
    example: '68f53a31eb15f30012ef736b',
  })
  @IsString()
  workoutId: string;

  // From Form
  @ApiProperty({ description: 'Exercise title', example: 'Bicep Curl' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Exercise duration in seconds', example: 30 })
  @Type(() => Number)
  @IsInt()
  duration: number;

  @ApiProperty({
    description: 'Exercise description',
    example: 'Bicep Curl is ...',
  })
  @IsString()
  description: string;

  // Workout info
  @ApiProperty({ enum: DifficultyLevel, example: DifficultyLevel.BEGINNER })
  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @ApiProperty({ enum: BodyPart, isArray: true, example: [BodyPart.LEGS] })
  @IsArray()
  @IsEnum(BodyPart, { each: true })
  bodyPartTags: BodyPart[];

  @ApiProperty({
    enum: Equipment,
    isArray: true,
    example: [Equipment.DUMBBELL],
  })
  @IsArray()
  @IsEnum(Equipment, { each: true })
  equipmentTags: Equipment[];

  // Array data
  @ApiProperty({
    description: 'Exercise steps',
    type: [String],
    example: ['Step 1', 'Step 2'],
  })
  @IsArray()
  @IsString({ each: true })
  steps: string[];

  @ApiProperty({
    description: 'Key benefits',
    type: [String],
    example: ['1', '2'],
  })
  @IsArray()
  @IsString({ each: true })
  keyBenefits: string[];

  @ApiProperty({
    description: 'Common mistakes',
    type: [String],

    example: ['Mistake 1', 'Mistake 2'],
  })
  @IsArray()
  @IsString({ each: true })
  commonMistakes: string[];

  // Exercise details
  @ApiProperty({ description: 'Equipment description', example: 'Dumbbell' })
  @IsString()
  equipment: string;

  @ApiProperty({ description: 'Exercise type', example: 'Strength' })
  @IsOptional()
  @IsString()
  type: string;

  @ApiProperty({ description: 'Primary muscle group', example: 'Biceps' })
  @IsString()
  primaryMuscle: string;

  @ApiProperty({ description: 'Secondary muscle group', example: 'Triceps' })
  @IsString()
  secondaryMuscle: string;

  @ApiProperty({ description: 'Calories burned', example: '100' })
  @IsString()
  caloriesBurned: string;
}
