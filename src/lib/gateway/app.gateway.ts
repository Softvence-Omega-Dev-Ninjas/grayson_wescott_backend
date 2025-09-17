import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ENVEnum } from '@project/common/enum/env.enum';
import { Notification } from '@project/common/interface/events-payload';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import {
  errorResponse,
  successResponse,
} from '@project/common/utils/response.util';
import { Server, Socket } from 'socket.io';
import { ChatEventsEnum } from '../chat/enum/chat-events.enum';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppGateway {
  private readonly logger = new Logger(AppGateway.name);
  private readonly clients = new Map<string, Set<Socket>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**--- INIT --- */
  public init(server: Server) {
    this.logger.log('Socket.IO server initialized', server.adapter?.name ?? '');
  }

  public async connection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        return this.disconnectWithError(client, 'Missing token');
      }

      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      });

      if (!payload.sub) {
        return this.disconnectWithError(client, 'Invalid token payload');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          avatarUrl: true,
        },
      });

      if (!user) return this.disconnectWithError(client, 'User not found');

      client.data.userId = user.id;
      client.data.user = payload;
      client.join(user.id);

      this.subscribeClient(user.id, client);

      this.logger.log(`User connected: ${user.id} (socket ${client.id})`);
      client.emit(ChatEventsEnum.SUCCESS, successResponse(user));
    } catch (err: any) {
      this.disconnectWithError(client, err?.message ?? 'Auth failed');
    }
  }

  public disconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.unsubscribeClient(userId, client);
      client.leave(userId);
      this.logger.log(`Client disconnected: ${userId}`);
    } else {
      this.logger.log(
        `Client disconnected: unknown user (socket ${client.id})`,
      );
    }
  }

  /** ---------------- CLIENT HELPERS ---------------- */
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

  private extractTokenFromSocket(client: Socket): string | null {
    const authHeader =
      (client.handshake.headers.authorization as string) ||
      (client.handshake.auth?.token as string);

    if (!authHeader) return null;
    return authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;
  }

  /** ---------------- ERROR HELPERS ---------------- */
  public disconnectWithError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, errorResponse(null, message));
    client.disconnect(true);
    this.logger.warn(`Disconnect ${client.id}: ${message}`);
  }

  public emitError(client: Socket, message: string) {
    client.emit(ChatEventsEnum.ERROR, errorResponse(null, message));
    return errorResponse(null, message);
  }

  /** ---------------- NOTIFICATION API ---------------- */
  public getClientsForUser(userId: string): Set<Socket> {
    return this.clients.get(userId) || new Set();
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
