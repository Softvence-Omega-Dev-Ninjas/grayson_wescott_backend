import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Valid email address',
  })
  @IsEmail()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'username123',
    description: 'A Unique username for the user',
  })
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'SecurePass123',
    description: 'Password (min 6 characters)',
  })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
