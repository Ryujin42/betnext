import { computeOdds } from './odds';
import { ODDS_DEFAULT, ODDS_MAX, ODDS_MIN } from './validation';

describe('computeOdds', () => {
  it('renvoie la cote par défaut sans mise sur l’issue', () => {
    expect(computeOdds(100, 0)).toBe(ODDS_DEFAULT);
  });

  it('renvoie la cote par défaut sans mise sur l’événement', () => {
    expect(computeOdds(0, 0)).toBe(ODDS_DEFAULT);
  });

  it('applique la formule total événement / total issue', () => {
    // 300 misés au total, 150 sur l'issue → 2.00
    expect(computeOdds(300, 150)).toBe(2);
  });

  it('borne la cote au plafond ODDS_MAX (issue peu jouée)', () => {
    // ratio 100/1 = 100 → plafonné à 5.00
    expect(computeOdds(100, 1)).toBe(ODDS_MAX);
  });

  it('borne la cote au plancher ODDS_MIN (issue ultra-favorite)', () => {
    // ratio 100/99 ≈ 1.01 → relevé à 1.10
    expect(computeOdds(100, 99)).toBe(ODDS_MIN);
  });

  it('arrondit à 2 décimales', () => {
    // 100/30 = 3.333... → 3.33
    expect(computeOdds(100, 30)).toBe(3.33);
  });
});
