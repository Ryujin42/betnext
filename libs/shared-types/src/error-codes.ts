/**
 * Codes d'erreur métier standardisés (cf. BETNEXT_CONTEXT §13).
 * Jamais de message d'erreur libre en production : on s'appuie sur ces codes.
 */
export enum BetNextErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'AUTH_001',
  TOKEN_EXPIRED = 'AUTH_002',
  ACCOUNT_SUSPENDED = 'AUTH_003',
  ACCOUNT_SELF_EXCLUDED = 'AUTH_004',
  UNDERAGE = 'AUTH_005',

  // Paris
  EVENT_NOT_PUBLISHED = 'BET_001',
  EVENT_ALREADY_STARTED = 'BET_002',
  INSUFFICIENT_BALANCE = 'BET_003',
  DAILY_LIMIT_REACHED = 'BET_004',
  WEEKLY_LIMIT_REACHED = 'BET_005',
  ODDS_CHANGED = 'BET_006',
  LOCK_ACQUISITION_FAILED = 'BET_007',

  // Wallet
  DEPOSIT_LIMIT_REACHED = 'WAL_001',
  PAYMENT_FAILED = 'WAL_002',
  INSUFFICIENT_FUNDS = 'WAL_003',

  // Jeu responsable
  LIMIT_INCREASE_PENDING = 'RG_001',
  SELF_EXCLUSION_ACTIVE = 'RG_002',

  // Générique
  VALIDATION_ERROR = 'GEN_001',
  NOT_FOUND = 'GEN_002',
  INTERNAL_ERROR = 'GEN_500',
}

/** Format de réponse d'erreur uniforme renvoyé par l'API. */
export interface IErrorResponse {
  statusCode: number;
  errorCode: BetNextErrorCode;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
}
