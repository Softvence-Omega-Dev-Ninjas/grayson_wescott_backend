import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ENVEnum } from '@project/common/enum/env.enum';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { ChatEventsEnum } from './enum/chat-events.enum';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/api/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log(
      'Socket.IO server initialized FOR PRIVATE CHAT',
      server.adapter?.name ?? '',
    );
  }

  /** Handle socket connection and authentication */
  async handleConnection(client: Socket) {
    // Accept token either in Authorization header (Bearer) or handshake.auth.token
    const authHeader =
      (client.handshake.headers.authorization as string) ||
      (client.handshake.auth && (client.handshake.auth.token as string));
    if (!authHeader) {
      client.emit(ChatEventsEnum.ERROR, {
        message: 'Missing authorization header',
      });
      client.disconnect(true);
      this.logger.warn('Missing auth header');
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;
    if (!token) {
      client.emit(ChatEventsEnum.ERROR, { message: 'Missing token' });
      client.disconnect(true);
      this.logger.warn('Missing token');
      return;
    }

    try {
      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      });
      const userId = payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (!user) {
        client.emit(ChatEventsEnum.ERROR, {
          message: 'User not found in database',
        });
        client.disconnect(true);
        this.logger.warn(`User not found: ${userId}`);
        return;
      }

      client.data.userId = userId;
      client.join(userId);
      client.emit(ChatEventsEnum.SUCCESS, userId);
      this.logger.log(
        `Private chat: User ${userId} connected, socket ${client.id}`,
      );
    } catch (err: any) {
      client.emit(ChatEventsEnum.ERROR, {
        message: err?.message ?? 'Auth failed',
      });
      client.disconnect(true);
      this.logger.warn(`Authentication failed: ${err?.message ?? err}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) client.leave(userId);
    this.logger.log(
      `Private chat disconnected: ${client.id} (user ${userId ?? 'unknown'})`,
    );
  }

  /** Helper for external services to emit new messages (keeps compatibility) */
  emitNewMessage(userId: string, message: any) {
    this.server.to(userId).emit(ChatEventsEnum.NEW_MESSAGE, message);
  }
}
