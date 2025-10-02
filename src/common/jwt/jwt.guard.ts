import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, ROLES_KEY } from './jwt.constants';
import { UserEnum } from '../enum/user.enum';
import { RequestWithUser } from './jwt.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // If route is public, skip authentication
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Otherwise use default passport-jwt flow
    const activate = (await super.canActivate(context)) as boolean;
    return activate;
  }

  // Ensure we return a meaningful error if no user
  handleRequest(err: any, user: any, info: any) {
    this.logger.error(err, info);
    if (err) {
      throw err;
    }
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get roles set on handler/class (handler priority)
    const requiredRoles = this.reflector.getAllAndOverride<UserEnum[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role metadata -> allow
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.role) {
      throw new ForbiddenException('User roles not found');
    }

    // support role as single value or array
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
