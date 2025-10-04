import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CurrentlyAssignedProgramDto {
  @ApiProperty({
    example: 'America/New_York',
    description: 'User timezone (Use IANA time zone database by Luxon Package)',
  })
  @IsNotEmpty()
  @IsString()
  userTimezone: string;
}
