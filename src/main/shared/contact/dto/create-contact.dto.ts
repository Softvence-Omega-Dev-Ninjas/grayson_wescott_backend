import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContactFormDto {
  @ApiProperty({
    description: 'Full name of the contact',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Email address of the contact',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Phone number of the contact',
    example: '+8801712345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Message from the contact',
    example: 'I would like to know more about your services.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Street address of the contact',
    example: '123 Main Street',
  })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({
    description: 'City of the contact',
    example: 'Dhaka',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Postal code of the contact',
    example: '1207',
  })
  @IsOptional()
  @IsString()
  postcode?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional file to upload',
  })
  @IsOptional()
  file?: Express.Multer.File;
}
