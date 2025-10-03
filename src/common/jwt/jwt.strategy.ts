import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    const jwtSecret = config.getOrThrow<string>(ENVEnum.JWT_SECRET);

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
      // unauthorized because token refers to no user
      throw new UnauthorizedException('User not found');
    }

    if (!user.isLoggedIn) {
      throw new ForbiddenException('User is not logged in');
    }

    // return payload — this will be assigned to req.user
    return payload;
  }
}
