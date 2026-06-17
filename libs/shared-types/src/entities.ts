import type { BetStatus, EventStatus, Role, TransactionStatus, TransactionType } from './enums';
import type { OutcomeCondition } from './outcome-condition.type';

// ── Schéma `users` ────────────────────────────────────────────────────────

/** Représentation partagée d'un utilisateur (sans données sensibles). */
export interface IUser {
  id: number;
  name: string;
  email: string;
  role: Role; // un seul rôle par utilisateur (ROLE_USER par défaut)
  birthDate: string; // ISO date (YYYY-MM-DD)
  createdAt: string; // ISO datetime
}

/** Session = refresh token rotatif persisté (cf. ADR-009). */
export interface ISession {
  id: number;
  userId: number;
  familyId: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Profil jeu responsable (limites ARJEL). */
export interface IRgProfile {
  id: number;
  userId: number;
  dailyBetLimit: number | null;
  weeklyBetLimit: number | null;
  dailyDepositLimit: number | null;
  weeklyDepositLimit: number | null;
  selfExcludedUntil: string | null;
  limitUpdatedAt: string | null;
}

// ── Schéma `events` ───────────────────────────────────────────────────────

export interface IGame {
  id: number;
  name: string; // 'lol', 'cs2', 'valorant'...
}

export interface ITournament {
  id: number;
  name: string;
  gameId: number;
}

/** Événement e-sport (table `e_sport_events`). */
export interface IEvent {
  id: number;
  name: string;
  startDate: string;
  status: EventStatus;
  tournamentId: number;
  gameId: number;
}

export interface ITeam {
  id: number;
  name: string;
  enrolledAt: string;
}

/** Pivot : N équipes engagées sur un événement. */
export interface IEventTeam {
  id: number;
  finalRank: number | null;
  eSportEventId: number;
  teamId: number;
}

/** Issue pariable d'un événement. */
export interface IOutcome {
  id: number;
  label: string;
  isWinner: boolean | null;
  odds: number;
  condition: OutcomeCondition;
  eSportEventId: number;
  eventPlayerId: number | null;
}

// ── Schéma `betting` ──────────────────────────────────────────────────────

export interface IBet {
  id: number;
  title: string;
  createdAt: string;
  closeDate: string;
  amount: number;
  lockedOdds: number;
  status: BetStatus;
  outcomeId: number;
  userId: number;
}

/** Historique append-only des changements de statut d'un pari. */
export interface IBetHistory {
  id: number;
  oldStatus: BetStatus | null;
  newStatus: BetStatus;
  reason: string | null;
  createdAt: string;
  betId: number;
}

/**
 * Vue enrichie d'un pari pour l'historique utilisateur (T5.4) : pari + contexte
 * événement/issue assemblé par JOIN (schéma unique).
 */
export interface IBetView extends IBet {
  eventName: string;
  eventStatus: EventStatus;
  outcomeLabel: string;
  /** Gain potentiel `amount × lockedOdds` (pari en cours ou gagné). */
  potentialGain: number;
  /** Gain effectif : crédité si gagné, `0` si perdu, `null` si encore en cours. */
  actualGain: number | null;
}

// ── Schéma `wallet` ───────────────────────────────────────────────────────

export interface ITransaction {
  id: number;
  userId: number;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  description: string | null;
  stripeId: string | null;
  createdAt: string;
}

/** Source de vérité du solde. */
export interface IBalance {
  id: number;
  userId: number;
  amount: number;
  updatedAt: string;
}
