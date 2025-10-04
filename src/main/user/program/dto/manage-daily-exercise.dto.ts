import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsDate } from 'class-validator';

export class ManageDailyExerciseDto {
  @ApiProperty({
    description: 'Status of the exercise for the user',
    enum: ExerciseStatus,
    example: ExerciseStatus.PENDING,
  })
  @IsEnum(ExerciseStatus)
  status: ExerciseStatus;

  @ApiPropertyOptional({
    description: 'Personal note added by the user for this exercise',
    example: 'Felt strong on this set, increase weight next time',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Equipment used by the user for this exercise',
    example: 'Dumbbell 10kg',
  })
  @IsOptional()
  @IsString()
  equipmentUsed?: string;
}
