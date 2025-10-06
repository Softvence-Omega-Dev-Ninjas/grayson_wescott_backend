import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client'; // adjust import path if different

export class AddAdminDto {
  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    description: 'Admin password (plain text, will be hashed)',
    minLength: 8,
    example: 'StrongPassword123!',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Full name of the admin',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Name cannot be empty if provided' })
  name?: string;

  @ApiProperty({
    description: 'Role of the user',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole' })
  role: UserRole = UserRole.ADMIN;
}
