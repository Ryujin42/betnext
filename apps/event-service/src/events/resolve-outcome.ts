import type { OutcomeCondition } from '@betnext/shared-types';

/** Faits constatés à la fin d'un événement, nécessaires à la résolution. */
export interface ResolutionContext {
  /** rang final par id d'`event_team` (1 = vainqueur). */
  rankByEventTeamId: ReadonlyMap<number, number>;
  matchDurationMinutes?: number;
  totalKills?: number;
  /** id d'`event_team` ayant réalisé le premier sang. */
  firstBloodEventTeamId?: number;
}

/**
 * Décide si une issue est gagnante (logique pure, cf. ADR-007). Le `switch`
 * sur `condition.type` est exhaustif : ajouter un type de pari = ajouter un
 * cas ici, sans toucher au reste (Open/Closed).
 *
 * @param outcomeEventPlayerId l'`event_player_id` de l'outcome (équipe visée).
 */
export function decideOutcomeWinner(
  condition: OutcomeCondition,
  outcomeEventPlayerId: number | null,
  ctx: ResolutionContext,
): boolean {
  switch (condition.type) {
    case 'TEAM_WINS':
      return outcomeEventPlayerId !== null && ctx.rankByEventTeamId.get(outcomeEventPlayerId) === 1;

    case 'MATCH_DURATION': {
      const value = ctx.matchDurationMinutes;
      if (value === undefined) {
        return false;
      }
      return condition.operator === 'LESS_THAN'
        ? value < condition.threshold
        : value > condition.threshold;
    }

    case 'TOTAL_KILLS': {
      const value = ctx.totalKills;
      if (value === undefined) {
        return false;
      }
      return condition.operator === 'LESS_THAN'
        ? value < condition.threshold
        : value > condition.threshold;
    }

    case 'FIRST_BLOOD':
      return (
        ctx.firstBloodEventTeamId !== undefined &&
        ctx.firstBloodEventTeamId === condition.eventPlayerId
      );
  }
}
