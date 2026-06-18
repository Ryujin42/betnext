import { Inject, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BetNextMetrics } from '@betnext/observability';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  BetNextTopic,
  BetResolvedEvent,
  EVENT_BUS,
  IEventBus,
  OddsUpdatedEvent,
} from '@betnext/shared-events';

interface JwtPayload {
  sub: number;
  role: string;
}

/**
 * WebSocket gateway temps réel (Lot 9 T9.3).
 *
 * - **Handshake JWT** : le client passe son access token via `auth.token` à
 *   la connexion. Refus immédiat si invalide.
 * - **Salles** :
 *   - `user:<id>` : automatiquement rejointe au handshake → notifications
 *     ciblées (`bet.won`, `bet.lost`).
 *   - `event:<id>` : rejointe via `subscribeEvent` quand le client affiche
 *     un évènement → cotes live (`odds.updated`).
 * - **Bridge bus → WS** : on s'abonne à l'`IEventBus` (Redis Pub/Sub en
 *   prod, in-memory en dev) et on relaie chaque évènement vers la bonne
 *   salle.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  // Garde-fou côté gateway : Fastify n'expose pas Socket.IO nativement,
  // l'adaptateur l'installe sur le même HTTP server.
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
    @Optional() private readonly metrics?: BetNextMetrics,
  ) {}

  /**
   * Branche les ponts bus → WS une fois le gateway prêt.
   *
   * T12.2 — émission **`.local`** volontaire : en multi-instance, chaque réplica
   * reçoit l'évènement via Redis Pub/Sub et émet à ses propres clients. Un
   * `server.to(...)` (cluster-wide via l'adaptateur Redis) provoquerait un
   * double envoi (une fois par réplica). `.local` garantit l'exactement-une-fois
   * et reste équivalent à `.to(...)` en mono-instance.
   */
  onModuleInit(): void {
    this.bus.subscribe<OddsUpdatedEvent>(BetNextTopic.OddsUpdated, (event) => {
      this.server.local.to(`event:${event.eSportEventId}`).emit('odds.updated', event);
    });
    this.bus.subscribe<BetResolvedEvent>(BetNextTopic.BetWon, (event) => {
      this.server.local.to(`user:${event.userId}`).emit('bet.won', event);
    });
    this.bus.subscribe<BetResolvedEvent>(BetNextTopic.BetLost, (event) => {
      this.server.local.to(`user:${event.userId}`).emit('bet.lost', event);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.extractTokenFromHeader(client.handshake.headers['authorization']);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      // Métadonnées propres à la socket — utilisées au cleanup et pour
      // restreindre les abonnements user-scoped.
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      await client.join(`user:${payload.sub}`);
      // T11.2 — jauge d'utilisateurs connectés en temps réel.
      this.metrics?.incActiveUsers();
      this.logger.log(`WS connecté : user ${payload.sub} (${payload.role}).`);
    } catch (err) {
      this.logger.warn(`WS refusé (JWT invalide) : ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    if (client.data.userId) {
      this.metrics?.decActiveUsers();
      this.logger.log(`WS déconnecté : user ${client.data.userId as number}.`);
    }
  }

  /** Le client demande à recevoir les cotes live d'un évènement précis. */
  @SubscribeMessage('subscribeEvent')
  async subscribeEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eSportEventId: number },
  ): Promise<{ ok: true }> {
    if (typeof payload?.eSportEventId !== 'number') {
      return { ok: true };
    }
    await client.join(`event:${payload.eSportEventId}`);
    return { ok: true };
  }

  /** L'utilisateur quitte la vue de l'évènement → on retire la salle. */
  @SubscribeMessage('unsubscribeEvent')
  async unsubscribeEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eSportEventId: number },
  ): Promise<{ ok: true }> {
    if (typeof payload?.eSportEventId !== 'number') {
      return { ok: true };
    }
    await client.leave(`event:${payload.eSportEventId}`);
    return { ok: true };
  }

  private extractTokenFromHeader(header: string | string[] | undefined): string | null {
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw?.startsWith('Bearer ')) return null;
    return raw.slice(7);
  }
}
