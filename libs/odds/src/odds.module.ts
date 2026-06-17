import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ODDS_CACHE } from './odds-cache.interface';
import { InMemoryOddsCache } from './in-memory-odds-cache';
import { RedisOddsCache, type RedisOddsCacheClient } from './redis-odds-cache';
import { OddsRecalculationService } from './odds-recalculation.service';

/**
 * Fournit le moteur de cotes (T5.2) + le cache de fallback (T7.3). Le module
 * hôte doit exposer une `DataSource` (TypeOrmModule) et la `MessagingModule`
 * (tokens EVENT_BUS / DISTRIBUTED_LOCK). À l'init, le service s'abonne à
 * `bet.placed`.
 *
 * Cache des cotes :
 * - Import direct (`OddsModule`) → cache mémoire (suffit en tests / mono-process).
 * - `OddsModule.forRoot({ driver: 'redis' })` → cache Redis (multi-process,
 *   ou via `ODDS_CACHE_DRIVER=redis` dans l'env).
 */
@Global()
@Module({
  providers: [OddsRecalculationService, { provide: ODDS_CACHE, useClass: InMemoryOddsCache }],
  exports: [OddsRecalculationService, ODDS_CACHE],
})
export class OddsModule {
  static forRoot(options: { driver?: 'in-memory' | 'redis' } = {}): DynamicModule {
    return {
      module: OddsModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        OddsRecalculationService,
        {
          provide: ODDS_CACHE,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const driver =
              options.driver ??
              (config.get<string>('ODDS_CACHE_DRIVER') === 'redis' ? 'redis' : 'in-memory');
            if (driver === 'redis') {
              const url = config.get<string>('REDIS_URL');
              if (!url) {
                throw new Error('OddsModule (driver=redis) : REDIS_URL est requis.');
              }
              return new RedisOddsCache(new Redis(url) as unknown as RedisOddsCacheClient);
            }
            return new InMemoryOddsCache();
          },
        },
      ],
      exports: [OddsRecalculationService, ODDS_CACHE],
    };
  }
}
