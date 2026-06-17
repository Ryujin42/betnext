/**
 * Abstraction du jeu responsable consommée avant un placement de pari (T5.1).
 * Au Lot 5, implémentation basique sur des plafonds par défaut (config) et le
 * cumul des mises (table `bets`). Au Lot 7 (T7.2), le user-service portera les
 * limites par utilisateur, l'auto-exclusion et la règle des 48 h derrière la
 * même interface.
 */
export interface IResponsibleGaming {
  /** Lève `DAILY_LIMIT_REACHED` / `WEEKLY_LIMIT_REACHED` si la mise dépasse un plafond. */
  assertCanBet(userId: number, stake: number): Promise<void>;
}

/** Token d'injection NestJS du jeu responsable. */
export const RESPONSIBLE_GAMING = Symbol('RESPONSIBLE_GAMING');
