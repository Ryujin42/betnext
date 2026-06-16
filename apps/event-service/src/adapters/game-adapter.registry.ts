import { Inject, Injectable } from '@nestjs/common';
import type { IGameDataProvider } from '@betnext/shared-types';
import { GAME_DATA_PROVIDERS } from './game-data-provider.token';

/**
 * Registre des adaptateurs de jeu. Il reçoit, par injection, **tous** les
 * `IGameDataProvider` enregistrés sous {@link GAME_DATA_PROVIDERS} et les
 * indexe par type — le reste du code n'a jamais besoin de connaître les
 * adaptateurs concrets (Open/Closed : ajouter un jeu = enregistrer un provider).
 */
@Injectable()
export class GameAdapterRegistry {
  private readonly byType = new Map<string, IGameDataProvider>();

  constructor(@Inject(GAME_DATA_PROVIDERS) providers: IGameDataProvider[]) {
    for (const provider of providers) {
      this.byType.set(provider.getAdapterType(), provider);
    }
  }

  getAdapter(type: string): IGameDataProvider {
    const adapter = this.byType.get(type);
    if (!adapter) {
      throw new Error(`Aucun adaptateur de jeu pour le type '${type}'`);
    }
    return adapter;
  }

  getAll(): IGameDataProvider[] {
    return [...this.byType.values()];
  }

  getTypes(): string[] {
    return [...this.byType.keys()];
  }
}
