import type { OutcomeCondition } from './outcome-condition.type';

/** Équipe telle que fournie par une source externe (avant import en base). */
export interface IExternalTeam {
  name: string;
}

/** Issue pariable proposée par l'adaptateur pour un événement externe. */
export interface IExternalOutcome {
  label: string;
  odds: number;
  condition: OutcomeCondition;
  /** Index de l'équipe concernée dans `teams` (null = issue transverse au match). */
  teamIndex: number | null;
}

/** Événement e-sport brut renvoyé par une source externe (API réelle ou mock). */
export interface IExternalEvent {
  externalId: string;
  game: string; // 'lol', 'cs2', 'valorant'...
  tournament: string;
  name: string;
  startDate: string; // ISO datetime
  teams: IExternalTeam[];
  outcomes: IExternalOutcome[];
}

/** Résultat d'un événement renvoyé par une source externe. */
export interface IEventResult {
  externalId: string;
  /** Classement final : index d'équipe (dans `teams`) → rang (1 = vainqueur). */
  finalRanking: { teamIndex: number; rank: number }[];
  /** Faits utiles à la résolution des issues transverses (durée, kills...). */
  facts?: {
    matchDurationMinutes?: number;
    totalKills?: number;
  };
}

/**
 * Forme normalisée prête à créer un événement en base. Le `CreateEventDto`
 * côté event-service (Lot 4.2) satisfait ce contrat.
 */
export interface INewEventInput {
  externalId: string;
  game: string;
  tournament: string;
  name: string;
  startDate: string;
  teams: IExternalTeam[];
  outcomes: IExternalOutcome[];
}

/**
 * Contrat commun des adaptateurs de jeu (cf. ADR-006 / CONTEXT §9).
 * Ajouter un jeu = implémenter cette interface et enregistrer l'adaptateur
 * dans le module NestJS, sans modifier le code existant (Open/Closed).
 */
export interface IGameDataProvider {
  /** Identifiant du jeu géré : 'lol', 'cs2', 'valorant'... */
  getAdapterType(): string;
  /** Récupère les événements en direct / à venir depuis la source. */
  fetchLiveEvents(): Promise<IExternalEvent[]>;
  /** Récupère le résultat d'un événement par son identifiant externe. */
  fetchEventResult(externalId: string): Promise<IEventResult>;
  /** Normalise un événement brut en payload de création. */
  mapToSportEvent(raw: IExternalEvent): INewEventInput;
}
