import { clampOdds, isValidEmail, ODDS_MAX, ODDS_MIN } from './validation';

describe('validation', () => {
  it('isValidEmail', () => {
    expect(isValidEmail('faker@betnext-v2.gg')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false); // pas de domaine avec point
  });

  it('clampOdds borne dans [1.10, 5.00]', () => {
    expect(clampOdds(0.5)).toBe(ODDS_MIN);
    expect(clampOdds(9)).toBe(ODDS_MAX);
    expect(clampOdds(2.3)).toBe(2.3);
  });
});
