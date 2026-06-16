/** Rôles applicatifs (valeurs alignées sur les autorités JWT). */
export enum Role {
  ADMIN = 'ROLE_ADMIN',
  MANAGER = 'ROLE_MANAGER',
  USER = 'ROLE_USER',
}

/** Cycle de vie d'un événement e-sport. */
export enum EventStatus {
  BROUILLON = 'BROUILLON',
  PUBLIE = 'PUBLIE',
  FERME = 'FERME',
  TERMINE = 'TERMINE',
  ANNULE = 'ANNULE',
}

/** Statut d'un pari. */
export enum BetStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
}

/** Nature d'une transaction de portefeuille. */
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  BET = 'BET',
  WIN = 'WIN',
  REFUND = 'REFUND',
}

/** Statut d'une transaction (retraits notamment). */
export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
