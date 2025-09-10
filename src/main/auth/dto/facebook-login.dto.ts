import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class FacebookLoginDto {
  @ApiProperty({ description: 'Access token from Facebook' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

export class FacebookLoginCompleteDto {
  @ApiProperty({
    description: 'Facebook access token obtained from the client',
    example: 'EAAGm0PX4ZCpsBA...',
  })
  @IsString()
  accessToken: string;

  @ApiProperty({
    description: 'User email (mandatory if Facebook did not return one)',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
