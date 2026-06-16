import { Module } from '@nestjs/common';
import type { IGameDataProvider } from '@betnext/shared-types';
import { GAME_DATA_PROVIDERS } from './game-data-provider.token';
import { MockLolAdapter } from './mock-lol.adapter';
import { GameAdapterRegistry } from './game-adapter.registry';
import { AdaptersController } from './adapters.controller';

/**
 * Enregistre les adaptateurs de jeu. Pour ajouter un jeu : créer la classe
 * d'adaptateur, l'ajouter aux `providers` et à la fabrique `GAME_DATA_PROVIDERS`.
 */
@Module({
  controllers: [AdaptersController],
  providers: [
    MockLolAdapter,
    {
      provide: GAME_DATA_PROVIDERS,
      useFactory: (lol: MockLolAdapter): IGameDataProvider[] => [lol],
      inject: [MockLolAdapter],
    },
    GameAdapterRegistry,
  ],
  exports: [GameAdapterRegistry],
})
export class AdaptersModule {}
