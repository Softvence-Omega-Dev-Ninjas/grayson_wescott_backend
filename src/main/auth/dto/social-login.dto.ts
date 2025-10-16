import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FacebookLoginDto {
  @ApiProperty({
    description: 'Access token from the social login provider',
    example: 'token',
  })
  @IsString()
  accessToken: string;
}

export class TwitterLoginDto {
  @ApiProperty({
    description: 'Authorization code received from Twitter OAuth',
    example: 'AQABAAIAAA...etc',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Code verifier for PKCE',
    example: 'random_generated_string_for_pkce',
  })
  @IsString()
  codeVerifier: string;
}
