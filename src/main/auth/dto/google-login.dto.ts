import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'ID token from Google Sign-In' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
