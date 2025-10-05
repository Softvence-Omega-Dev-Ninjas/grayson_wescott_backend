import { UserRole } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  phone?: string;

  @Expose()
  username?: string;

  @Expose()
  name?: string;

  @Expose()
  avatarUrl?: string;

  @Expose()
  role: UserRole;

  @Expose()
  signUpMethod: string;

  @Expose()
  isVerified: boolean;

  @Expose()
  isPhoneVerified: boolean;

  @Expose()
  isLoggedIn: boolean;

  @Expose()
  isTwoFAEnabled: boolean;

  @Expose()
  twoFAMethod?: string;

  @Expose()
  timezone: string;

  @Expose()
  allowDirectMessages: boolean;

  @Expose()
  allowEmailMessages: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
