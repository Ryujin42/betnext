/**
 * Token d'injection pour la collection d'adaptateurs de jeu.
 * Tous les `IGameDataProvider` sont fournis sous ce token, ce qui permet au
 * `GameAdapterRegistry` de les découvrir sans les connaître individuellement.
 */
export const GAME_DATA_PROVIDERS = Symbol('GAME_DATA_PROVIDERS');
