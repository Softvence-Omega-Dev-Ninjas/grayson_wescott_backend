import { Request } from 'express';

export interface RequestWithUser extends Request {
  user?: JWTPayload;
}

export interface JWTPayload {
  sub: string;
  email: string;
  roles: string;
}
