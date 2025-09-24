import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ENVEnum } from '../enum/env.enum';
import { JWTPayload } from './jwt.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = config.get<string>(ENVEnum.JWT_SECRET);
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JWTPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.isLoggedIn) {
      throw new ForbiddenException('User is not logged in');
    }

    return payload
  }
}
