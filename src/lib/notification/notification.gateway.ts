import { Injectable, Logger } from '@nestjs/common';
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
import { Notification } from '@project/common/interface/events-payload';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/api/notification',
})
@Injectable()
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);
  private readonly clients = new Map<string, Set<Socket>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log('Socket.IO server initialized', server.adapter.name);
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        this.logger.warn('Missing token');
        return client.disconnect(true);
      }

      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      });

      if (!payload.sub) {
        this.logger.warn('Invalid token payload: missing sub');
        return client.disconnect(true);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        this.logger.warn(`User not found for ID: ${payload.sub}`);
        return client.disconnect(true);
      }

      client.data = { user: payload };
      this.subscribeClient(user.id, client);

      this.logger.log(`Client connected: ${user.id}`);
    } catch (err: any) {
      this.logger.warn(`JWT verification failed: ${err.message || err}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub;
    if (userId) {
      this.unsubscribeClient(userId, client);
      this.logger.log(`Client disconnected: ${userId}`);
    } else {
      this.logger.log('Client disconnected: unknown user');
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    const authHeader =
      client.handshake.headers.authorization || client.handshake.auth?.token;

    if (!authHeader) return null;

    return authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;
  }

  private subscribeClient(userId: string, client: Socket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(client);
    this.logger.debug(`Subscribed client to user ${userId}`);
  }

  private unsubscribeClient(userId: string, client: Socket) {
    const set = this.clients.get(userId);
    if (!set) return;

    set.delete(client);
    this.logger.debug(`Unsubscribed client from user ${userId}`);
    if (set.size === 0) {
      this.clients.delete(userId);
      this.logger.debug(`Removed empty client set for user ${userId}`);
    }
  }

  public getClientsForUser(userId: string): Set<Socket> {
    return this.clients.get(userId) || new Set();
  }

  public getDelay(publishAt: Date): number {
    const delay = publishAt.getTime() - Date.now();
    return delay > 0 ? delay : 0;
  }

  public async notifySingleUser(
    userId: string,
    event: string,
    data: Notification,
  ): Promise<void> {
    const clients = this.getClientsForUser(userId);
    if (clients.size === 0) {
      this.logger.warn(`No clients connected for user ${userId}`);
      return;
    }

    clients.forEach((client) => {
      client.emit(event, data);
      this.logger.log(`Notification sent to user ${userId} via event ${event}`);
    });
  }

  public async notifyMultipleUsers(
    userIds: string[],
    event: string,
    data: Notification,
  ): Promise<void> {
    if (userIds.length === 0) {
      this.logger.warn('No user IDs provided for notification');
      return;
    }

    userIds.forEach((userId) => {
      this.notifySingleUser(userId, event, data);
    });
  }

  public async notifyAllUsers(
    event: string,
    data: Notification,
  ): Promise<void> {
    this.clients.forEach((clients, userId) => {
      clients.forEach((client) => {
        client.emit(event, data);
        this.logger.log(
          `Notification sent to all users via event ${event} for user ${userId}`,
        );
      });
    });
  }
}
