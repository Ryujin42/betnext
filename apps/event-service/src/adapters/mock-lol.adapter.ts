import { Injectable } from '@nestjs/common';
import type {
  IEventResult,
  IExternalEvent,
  IGameDataProvider,
  INewEventInput,
} from '@betnext/shared-types';

/**
 * Adaptateur LoL **mocké** (cf. ADR-006) : retourne des événements en dur,
 * sans appel réseau. Le vrai `LolEsportsAdapter` se branchera plus tard
 * derrière la même interface, sans rien changer ailleurs.
 */
@Injectable()
export class MockLolAdapter implements IGameDataProvider {
  private readonly events: IExternalEvent[] = [
    {
      externalId: 'lol-lck-2026-final',
      game: 'lol',
      tournament: 'LCK Spring 2026',
      name: 'T1 vs Gen.G — Finale',
      startDate: '2026-07-01T17:00:00.000Z',
      teams: [{ name: 'T1' }, { name: 'Gen.G' }],
      outcomes: [
        { label: 'T1 gagne', odds: 1.85, condition: { type: 'TEAM_WINS' }, teamIndex: 0 },
        { label: 'Gen.G gagne', odds: 1.95, condition: { type: 'TEAM_WINS' }, teamIndex: 1 },
        {
          label: 'Match < 30 min',
          odds: 2.4,
          condition: {
            type: 'MATCH_DURATION',
            operator: 'LESS_THAN',
            threshold: 30,
            unit: 'minutes',
          },
          teamIndex: null,
        },
        {
          label: '+ de 25 kills au total',
          odds: 1.7,
          condition: { type: 'TOTAL_KILLS', operator: 'GREATER_THAN', threshold: 25 },
          teamIndex: null,
        },
      ],
    },
    {
      externalId: 'lol-msi-2026-g2-blg',
      game: 'lol',
      tournament: 'MSI 2026',
      name: 'G2 vs BLG — Demi-finale',
      startDate: '2026-07-03T16:00:00.000Z',
      teams: [{ name: 'G2 Esports' }, { name: 'Bilibili Gaming' }],
      outcomes: [
        { label: 'G2 gagne', odds: 2.1, condition: { type: 'TEAM_WINS' }, teamIndex: 0 },
        { label: 'BLG gagne', odds: 1.72, condition: { type: 'TEAM_WINS' }, teamIndex: 1 },
        {
          label: 'Match > 35 min',
          odds: 2.05,
          condition: {
            type: 'MATCH_DURATION',
            operator: 'GREATER_THAN',
            threshold: 35,
            unit: 'minutes',
          },
          teamIndex: null,
        },
      ],
    },
    {
      externalId: 'lol-lec-2026-fnc-vit',
      game: 'lol',
      tournament: 'LEC Summer 2026',
      name: 'Fnatic vs Vitality',
      startDate: '2026-07-05T18:00:00.000Z',
      teams: [{ name: 'Fnatic' }, { name: 'Team Vitality' }],
      outcomes: [
        { label: 'Fnatic gagne', odds: 1.9, condition: { type: 'TEAM_WINS' }, teamIndex: 0 },
        { label: 'Vitality gagne', odds: 1.9, condition: { type: 'TEAM_WINS' }, teamIndex: 1 },
      ],
    },
  ];

  private readonly results: Record<string, IEventResult> = {
    'lol-lck-2026-final': {
      externalId: 'lol-lck-2026-final',
      finalRanking: [
        { teamIndex: 0, rank: 1 },
        { teamIndex: 1, rank: 2 },
      ],
      facts: { matchDurationMinutes: 28, totalKills: 31 },
    },
  };

  getAdapterType(): string {
    return 'lol';
  }

  fetchLiveEvents(): Promise<IExternalEvent[]> {
    // Copie défensive pour que l'appelant ne mute pas l'état interne du mock.
    return Promise.resolve(this.events.map((e) => structuredClone(e)));
  }

  fetchEventResult(externalId: string): Promise<IEventResult> {
    const result = this.results[externalId];
    if (!result) {
      return Promise.reject(new Error(`Aucun résultat mocké pour l'événement '${externalId}'`));
    }
    return Promise.resolve(structuredClone(result));
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
}
