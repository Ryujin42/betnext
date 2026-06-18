import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IGameDataProvider } from '@betnext/shared-types';
import { GAME_DATA_PROVIDERS } from './game-data-provider.token';
import { MockLolAdapter } from './mock-lol.adapter';
import { PandaScoreLolAdapter } from './pandascore-lol.adapter';
import { GameAdapterRegistry } from './game-adapter.registry';
import { AdaptersController } from './adapters.controller';

/**
 * Enregistre l'adapter LoL actif en fonction de `GAME_ADAPTER` :
 * - `mock` (défaut) → {@link MockLolAdapter}, événements en dur, sans réseau.
 * - `pandascore` → {@link PandaScoreLolAdapter}, appelle l'API pandascore.co
 *   (requiert `PANDASCORE_TOKEN`).
 *
 * Pour ajouter un nouveau jeu : créer l'adapter, l'ajouter aux `providers` et
 * étendre la `useFactory`.
 */
@Module({
  controllers: [AdaptersController],
  providers: [
    MockLolAdapter,
    PandaScoreLolAdapter,
    {
      provide: GAME_DATA_PROVIDERS,
      inject: [ConfigService, MockLolAdapter, PandaScoreLolAdapter],
      useFactory: (
        config: ConfigService,
        mock: MockLolAdapter,
        pandascore: PandaScoreLolAdapter,
      ): IGameDataProvider[] => {
        const driver = config.get<string>('GAME_ADAPTER') ?? 'mock';
        const logger = new Logger('AdaptersModule');
        if (driver === 'pandascore') {
          logger.log("Adapter LoL actif : 'pandascore' (API pandascore.co).");
          return [pandascore];
        }
        logger.log("Adapter LoL actif : 'mock' (données en dur).");
        return [mock];
      },
    },
    GameAdapterRegistry,
  ],
  exports: [GameAdapterRegistry],
})
export class AdaptersModule {}
