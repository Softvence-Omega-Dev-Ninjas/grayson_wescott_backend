import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class WeeklyReviewDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Weekly review content goes here...' })
  review: string;
}
