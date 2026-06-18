import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Adaptateur Socket.IO branché sur Redis (Lot 12 — T12.2).
 *
 * En multi-instance (api-gateway répliqué derrière nginx), chaque instance ne
 * connaît nativement que ses propres sockets. L'adaptateur Redis partage l'état
 * des salles entre instances : `socket.join('event:5')` et les broadcasts
 * deviennent cohérents cluster-wide, et un client peut être joint quelle que
 * soit l'instance qui le sert. Deux clients ioredis dédiés (pub/sub).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(this.redisUrl);
    const subClient = pubClient.duplicate();
    this.clients = [pubClient, subClient];
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Adaptateur Socket.IO Redis activé (broadcast multi-instance).');
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async closeRedis(): Promise<void> {
    await Promise.allSettled(this.clients.map((c) => c.quit()));
  }
}
