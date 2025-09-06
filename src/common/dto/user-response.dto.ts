import { UserRoles } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  profileUrl?: string;

  @Expose()
  role: UserRoles;

  @Expose()
  isLogin: boolean;

  @Expose()
  lastLoginAt?: Date;

  @Expose()
  isVerified: boolean;

  @Expose()
  isTwoFAEnabled?: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
