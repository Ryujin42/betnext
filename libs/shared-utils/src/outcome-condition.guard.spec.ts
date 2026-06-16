import { BetNextError } from './errors';
import { assertOutcomeCondition, isValidOutcomeCondition } from './outcome-condition.guard';

describe('outcome condition guard', () => {
  it('accepte les conditions valides', () => {
    expect(isValidOutcomeCondition({ type: 'TEAM_WINS' })).toBe(true);
    expect(
      isValidOutcomeCondition({
        type: 'MATCH_DURATION',
        operator: 'LESS_THAN',
        threshold: 30,
        unit: 'minutes',
      }),
    ).toBe(true);
    expect(
      isValidOutcomeCondition({ type: 'TOTAL_KILLS', operator: 'GREATER_THAN', threshold: 25 }),
    ).toBe(true);
    expect(isValidOutcomeCondition({ type: 'FIRST_BLOOD', eventPlayerId: 3 })).toBe(true);
  });

  it('rejette les structures invalides', () => {
    expect(
      isValidOutcomeCondition({
        type: 'MATCH_DURATION',
        operator: 'EQ',
        threshold: 30,
        unit: 'minutes',
      }),
    ).toBe(false);
    expect(isValidOutcomeCondition({ type: 'TOTAL_KILLS', operator: 'LESS_THAN' })).toBe(false);
    expect(isValidOutcomeCondition({ type: 'NOPE' })).toBe(false);
    expect(isValidOutcomeCondition(null)).toBe(false);
    expect(isValidOutcomeCondition('x')).toBe(false);
  });

  it('assertOutcomeCondition renvoie la valeur typée si valide', () => {
    const condition = assertOutcomeCondition({ type: 'TEAM_WINS' });
    expect(condition.type).toBe('TEAM_WINS');
  });

  it('assertOutcomeCondition lève une BetNextError si invalide', () => {
    expect(() => assertOutcomeCondition({ type: 'NOPE' })).toThrow(BetNextError);
  });
});
