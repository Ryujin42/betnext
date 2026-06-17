import type { OutcomeCondition } from '@betnext/shared-types';
import { decideOutcomeWinner, type ResolutionContext } from './resolve-outcome';

const ctx: ResolutionContext = {
  rankByEventTeamId: new Map([
    [10, 1], // event_team 10 = vainqueur
    [11, 2],
  ]),
  matchDurationMinutes: 28,
  totalKills: 31,
  firstBloodEventTeamId: 10,
};

describe('decideOutcomeWinner', () => {
  it('TEAM_WINS : gagnant si l’équipe de l’outcome est 1ère', () => {
    const c: OutcomeCondition = { type: 'TEAM_WINS' };
    expect(decideOutcomeWinner(c, 10, ctx)).toBe(true);
    expect(decideOutcomeWinner(c, 11, ctx)).toBe(false);
    expect(decideOutcomeWinner(c, null, ctx)).toBe(false);
  });

  it('MATCH_DURATION : compare la durée selon l’opérateur', () => {
    expect(
      decideOutcomeWinner(
        { type: 'MATCH_DURATION', operator: 'LESS_THAN', threshold: 30, unit: 'minutes' },
        null,
        ctx,
      ),
    ).toBe(true); // 28 < 30
    expect(
      decideOutcomeWinner(
        { type: 'MATCH_DURATION', operator: 'GREATER_THAN', threshold: 30, unit: 'minutes' },
        null,
        ctx,
      ),
    ).toBe(false); // 28 !> 30
  });

  it('TOTAL_KILLS : compare le total de kills', () => {
    expect(
      decideOutcomeWinner(
        { type: 'TOTAL_KILLS', operator: 'GREATER_THAN', threshold: 25 },
        null,
        ctx,
      ),
    ).toBe(true); // 31 > 25
    expect(
      decideOutcomeWinner({ type: 'TOTAL_KILLS', operator: 'LESS_THAN', threshold: 25 }, null, ctx),
    ).toBe(false);
  });

  it('FIRST_BLOOD : gagnant si l’équipe de la condition a le premier sang', () => {
    expect(decideOutcomeWinner({ type: 'FIRST_BLOOD', eventPlayerId: 10 }, 10, ctx)).toBe(true);
    expect(decideOutcomeWinner({ type: 'FIRST_BLOOD', eventPlayerId: 11 }, 11, ctx)).toBe(false);
  });

  it('renvoie false si le fait nécessaire est absent', () => {
    const empty: ResolutionContext = { rankByEventTeamId: new Map() };
    expect(
      decideOutcomeWinner(
        { type: 'MATCH_DURATION', operator: 'LESS_THAN', threshold: 30, unit: 'minutes' },
        null,
        empty,
      ),
    ).toBe(false);
  });
});
