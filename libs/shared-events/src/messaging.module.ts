import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DISTRIBUTED_LOCK } from './distributed-lock.interface';
import { EVENT_BUS } from './event-bus.interface';
import { InMemoryEventBus } from './in-memory-event-bus';
import { InMemoryLock } from './in-memory-lock';
import { RedisDistributedLock, type RedisLockClient } from './redis-distributed-lock';
import { RedisEventBus } from './redis-event-bus';

/** Driver disponibles pour le bus / le verrou. `redis` requiert `REDIS_URL`. */
export type MessagingDriver = 'in-memory' | 'redis';

export interface MessagingModuleOptions {
  /** Si omis, lit `EVENT_BUS_DRIVER` (défaut `in-memory`). */
  driver?: MessagingDriver;
}

/**
 * Module de messagerie partagé. Par défaut (import direct) fournit les
 * implémentations in-memory (Lot 5) sous les tokens {@link EVENT_BUS} et
 * {@link DISTRIBUTED_LOCK}. Avec `MessagingModule.forRoot({ driver: 'redis' })`
 * (ou `EVENT_BUS_DRIVER=redis`), le bus passe en Redis Pub/Sub et le verrou
 * en Redis SET NX EX (Lot 7).
 *
 * `@Global` : un seul bus par processus, partagé entre producteurs et
 * consommateurs.
 */
@Global()
@Module({
  providers: [
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: DISTRIBUTED_LOCK, useClass: InMemoryLock },
  ],
  exports: [EVENT_BUS, DISTRIBUTED_LOCK],
})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions = {}): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: EVENT_BUS,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const driver = MessagingModule.resolveDriver(options, config);
            if (driver === 'redis') {
              const url = MessagingModule.requireRedisUrl(config);
              // Deux clients : ioredis verrouille le subscriber, on sépare pub/sub.
              const publisher = new Redis(url);
              const subscriber = new Redis(url);
              return new RedisEventBus(publisher, subscriber);
            }
            return new InMemoryEventBus();
          },
        },
        {
          provide: DISTRIBUTED_LOCK,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const driver = MessagingModule.resolveDriver(options, config);
            if (driver === 'redis') {
              const url = MessagingModule.requireRedisUrl(config);
              const client = new Redis(url) as unknown as RedisLockClient;
              return new RedisDistributedLock(client);
            }
            return new InMemoryLock();
          },
        },
      ],
      exports: [EVENT_BUS, DISTRIBUTED_LOCK],
    };
  }

  private static resolveDriver(
    options: MessagingModuleOptions,
    config: ConfigService,
  ): MessagingDriver {
    if (options.driver) {
      return options.driver;
    }
    const env = config.get<string>('EVENT_BUS_DRIVER');
    return env === 'redis' ? 'redis' : 'in-memory';
  }

  private static requireRedisUrl(config: ConfigService): string {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('MessagingModule (driver=redis) : REDIS_URL est requis.');
    }
    return url;
  }
}
