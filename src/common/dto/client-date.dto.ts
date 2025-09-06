import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class ClientDateDto {
  @ApiProperty({
    description:
      'Date in ISO 8601 format (UTC). Example: 2025-08-29T02:04:46.000Z',
    type: String,
    format: 'date-time',
    example: '2025-08-29T02:04:46.000Z',
  })
  @IsISO8601()
  date: string;
}
