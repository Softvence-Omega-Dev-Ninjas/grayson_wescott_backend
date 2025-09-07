import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookLoginDto {
  @ApiProperty({ description: 'Access token from Facebook' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
