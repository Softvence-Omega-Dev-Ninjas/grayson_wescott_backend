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
import { PayloadForSocketClient } from '@project/common/interface/socket-client-payload';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/js/notification',
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

  /**
   * Called when a client is connected to the server.
   * @param client - The client that connected.
   *
   * Extracts the JWT token from the client's headers or query, verifies it,
   * and if valid, subscribes the client to the corresponding user's
   * notification room.
   *
   * If the token is invalid or missing, the client is disconnected.
   *
   * If the user is not found, the client is disconnected.
   *
   * If the user's notification toggle is invalid, the client is disconnected.
   */
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
          notificationToggle: true,
        },
      });

      if (!user) {
        this.logger.warn(`User not found for ID: ${payload.sub}`);
        return client.disconnect(true);
      }

      const payloadForSocketClient: PayloadForSocketClient = {
        sub: user.id,
        email: user.email,
        emailToggle: user.notificationToggle?.email || false,
        userUpdates: user.notificationToggle?.userUpdates || false,
        communication: user.notificationToggle?.communication || false,
        surveyAndPoll: user.notificationToggle?.surveyAndPoll || false,
        tasksAndProjects: user.notificationToggle?.tasksAndProjects || false,
        scheduling: user.notificationToggle?.scheduling || false,
        message: user.notificationToggle?.message || false,
        userRegistration: user.notificationToggle?.userRegistration || false,
      };

      client.data = { user: payloadForSocketClient };
      this.subscribeClient(user.id, client);

      this.logger.log(`Client connected: ${user.id}`);
    } catch (err: any) {
      this.logger.warn(`JWT verification failed: ${err.message || err}`);
      client.disconnect(true);
    }
  }

  /**
   * Handles the disconnection of a client from the server.
   *
   * If a user ID is associated with the client, it unsubscribes the client from
   * the user's notification room and logs the disconnection with the user ID.
   * If no user ID is associated, logs the disconnection for an unknown user.
   *
   * @param client - The socket client that has disconnected.
   */

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub;
    if (userId) {
      this.unsubscribeClient(userId, client);
      this.logger.log(`Client disconnected: ${userId}`);
    } else {
      this.logger.log('Client disconnected: unknown user');
    }
  }

  /**
   * Extracts the JWT token from the client's headers or query.
   *
   * If the token is present in the Authorization header, it is extracted.
   * If the token is not present in the Authorization header, the query
   * parameter 'token' is checked for the token. If the token is present in
   * the query parameter, it is extracted.
   *
   * If the token is not present in either the Authorization header or the
   * query parameter, null is returned.
   *
   * If the token is present in the Authorization header but is not a Bearer
   * token, the raw token is returned.
   *
   * @param client - The socket client.
   * @returns The extracted JWT token or null if not present.
   */
  private extractTokenFromSocket(client: Socket): string | null {
    const authHeader =
      client.handshake.headers.authorization || client.handshake.auth?.token;

    if (!authHeader) return null;

    return authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;
  }

  /**
   * Subscribes a client to a user's notification room.
   *
   * If the user ID is not present in the clients map, a new Set is created
   * and associated with the user ID. The client is then added to the Set.
   * A log message is recorded with the user ID.
   *
   * @param userId - The ID of the user to subscribe the client to.
   * @param client - The client socket to subscribe.
   */
  private subscribeClient(userId: string, client: Socket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(client);
    this.logger.debug(`Subscribed client to user ${userId}`);
  }

  /**
   * Unsubscribes a client from a user's notification room.
   *
   * If the user ID is not present in the clients map, the function does
   * nothing.
   * If the user ID is present in the clients map, the client is removed
   * from the Set associated with the user ID. If the Set is then empty, it
   * is removed from the map.
   * A log message is recorded with the user ID.
   *
   * @param userId - The ID of the user to unsubscribe the client from.
   * @param client - The client socket to unsubscribe.
   */
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

  /**
   * Retrieves the set of clients subscribed to the given user's notification room.
   *
   * If the user ID is not present in the clients map, an empty Set is returned.
   *
   * @param userId - The ID of the user to retrieve clients for.
   * @returns A Set of client sockets subscribed to the user's notification room.
   */
  public getClientsForUser(userId: string): Set<Socket> {
    return this.clients.get(userId) || new Set();
  }

  /**
   * Calculates the delay in milliseconds between the current time and the given
   * publish date.
   * If the publish date is in the past, the delay is set to 0.
   * @param publishAt - The date to calculate the delay for.
   * @returns The calculated delay in milliseconds.
   */
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
