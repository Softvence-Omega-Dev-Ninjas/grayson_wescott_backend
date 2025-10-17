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
    description: 'Access token from the social login provider',
    example: 'token',
  })
  @IsString()
  oauthToken: string;

  @ApiProperty({
    description: 'Access token secret from the social login provider',
    example: 'token',
  })
  @IsString()
  oauthTokenSecret: string;

  @ApiProperty({
    description: 'Verifier from the social login provider',
    example: 'token',
  })
  @IsString()
  oauthVerifier: string;
}
