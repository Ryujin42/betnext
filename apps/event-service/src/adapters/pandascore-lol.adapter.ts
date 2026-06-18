import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IEventResult,
  IExternalEvent,
  IGameDataProvider,
  INewEventInput,
} from '@betnext/shared-types';

interface PandaScoreOpponent {
  opponent: { id: number; name: string } | null;
}

interface PandaScoreMatch {
  id: number;
  name: string;
  begin_at: string | null;
  status: 'not_started' | 'running' | 'finished' | 'canceled' | 'postponed';
  winner_id: number | null;
  tournament: { name: string } | null;
  league: { name: string } | null;
  opponents: PandaScoreOpponent[];
}

const PANDASCORE_BASE = 'https://api.pandascore.co';
/** Cote par défaut posée à l'import — recalculée dynamiquement par l'odds-engine au premier pari. */
const DEFAULT_ODDS = 1.5;

/**
 * Adaptateur PandaScore (API e-sport tierce, pandascore.co) pour LoL.
 *
 * PandaScore expose les matchs e-sport agrégés derrière une API REST simple,
 * en freemium. C'est l'option « API réelle » de l'event-service, en plus du
 * {@link MockLolAdapter} qui reste utilisable hors-ligne.
 *
 * Activation : `GAME_ADAPTER=pandascore` + `PANDASCORE_TOKEN=<token>`.
 *
 * Limitations connues :
 * - PandaScore ne fournit pas de cotes — on pose `DEFAULT_ODDS` à l'import,
 *   l'odds-engine recalcule dès qu'un pari est placé.
 * - Seul `TEAM_WINS` est extrait (un outcome par équipe), pas les paris
 *   transverses (durée, kills) qui demanderaient une logique de résolution
 *   spécifique côté résolution d'événement.
 */
@Injectable()
export class PandaScoreLolAdapter implements IGameDataProvider {
  private readonly logger = new Logger(PandaScoreLolAdapter.name);
  private readonly token: string;

  constructor(config: ConfigService) {
    // Validation différée : `mock` reste l'adapter par défaut, on ne veut pas
    // empêcher l'event-service de booter quand PANDASCORE_TOKEN est vide. La
    // vérif explicite est faite au premier appel réseau.
    this.token = config.get<string>('PANDASCORE_TOKEN') ?? '';
  }

  getAdapterType(): string {
    return 'lol';
  }

  async fetchLiveEvents(): Promise<IExternalEvent[]> {
    const matches = await this.get<PandaScoreMatch[]>('/lol/matches/upcoming?per_page=30');
    return matches
      .filter(
        (m) =>
          m.begin_at !== null &&
          m.opponents.length === 2 &&
          m.opponents[0]?.opponent !== null &&
          m.opponents[1]?.opponent !== null,
      )
      .map((m) => this.mapMatch(m));
  }

  async fetchEventResult(externalId: string): Promise<IEventResult> {
    const id = this.parseExternalId(externalId);
    const match = await this.get<PandaScoreMatch>(`/lol/matches/${id}`);
    if (match.status !== 'finished' || match.winner_id === null) {
      throw new Error(`Match ${externalId} pas encore terminé (statut: ${match.status}).`);
    }
    const finalRanking = match.opponents.map((o, index) => ({
      teamIndex: index,
      rank: o.opponent?.id === match.winner_id ? 1 : 2,
    }));
    return { externalId, finalRanking, facts: {} };
  }

  mapToSportEvent(raw: IExternalEvent): INewEventInput {
    return {
      externalId: raw.externalId,
      game: raw.game,
      tournament: raw.tournament,
      name: raw.name,
      startDate: raw.startDate,
      teams: raw.teams,
      outcomes: raw.outcomes,
    };
  }

  private mapMatch(m: PandaScoreMatch): IExternalEvent {
    const teamA = m.opponents[0].opponent!.name;
    const teamB = m.opponents[1].opponent!.name;
    return {
      externalId: this.externalIdFor(m.id),
      game: 'lol',
      tournament: m.tournament?.name ?? m.league?.name ?? 'Tournoi inconnu',
      name: m.name,
      startDate: m.begin_at!,
      teams: [{ name: teamA }, { name: teamB }],
      outcomes: [
        {
          label: `${teamA} gagne`,
          odds: DEFAULT_ODDS,
          condition: { type: 'TEAM_WINS' },
          teamIndex: 0,
        },
        {
          label: `${teamB} gagne`,
          odds: DEFAULT_ODDS,
          condition: { type: 'TEAM_WINS' },
          teamIndex: 1,
        },
      ],
    };
  }

  private externalIdFor(matchId: number): string {
    return `pandascore-lol-${matchId}`;
  }

  /** Récupère l'id PandaScore numérique depuis l'externalId qu'on a fabriqué. */
  private parseExternalId(externalId: string): number {
    const match = externalId.match(/^pandascore-lol-(\d+)$/);
    if (!match) {
      throw new Error(`externalId PandaScore invalide : ${externalId}`);
    }
    return Number(match[1]);
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.token) {
      throw new Error(
        'PANDASCORE_TOKEN manquant. Crée un compte sur pandascore.co, colle le token dans .env, puis bascule GAME_ADAPTER=pandascore.',
      );
    }
    const url = `${PANDASCORE_BASE}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`PandaScore ${path} → HTTP ${res.status} — ${body.slice(0, 200)}`);
      throw new Error(`PandaScore ${path} a répondu ${res.status}`);
    }
    return (await res.json()) as T;
  }
}
