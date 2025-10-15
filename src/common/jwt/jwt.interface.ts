import { AuthProvider } from '@prisma/client';
import { Request } from 'express';

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user?: JWTPayload;
}

export interface SocialLoginEmailPayload {
  email: string;
  otp: string;
  provider: AuthProvider;
  providerId: string;
}
