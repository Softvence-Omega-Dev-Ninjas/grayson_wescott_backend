import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { UserEnum } from '../enum/user.enum';
import { JwtAuthGuard, RolesGuard } from './jwt.guard';
import { RequestWithUser } from './jwt.interface';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserEnum[]) => SetMetadata(ROLES_KEY, roles);

export const GetUser = createParamDecorator(
  (key: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    return key ? user?.[key] : user;
  },
);

export function ValidateAuth(...roles: UserEnum[]) {
  const decorators = [UseGuards(JwtAuthGuard, RolesGuard)];
  if (roles.length > 0) {
    decorators.push(Roles(...roles));
  }
  return applyDecorators(...decorators);
}

export function ValidateSuperAdmin() {
  return ValidateAuth(UserEnum.SUPER_ADMIN);
}

export function ValidateAdmin() {
  return ValidateAuth(UserEnum.ADMIN, UserEnum.SUPER_ADMIN);
}

export function ValidateEmployee() {
  return ValidateAuth(UserEnum.EMPLOYEE, UserEnum.SUPER_ADMIN);
}
