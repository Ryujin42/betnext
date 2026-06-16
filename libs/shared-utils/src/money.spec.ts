import { addCents, applyOdds, formatEuros, fromCents, subtractCents, toCents } from './money';

describe('money (centimes entiers)', () => {
  it('toCents / fromCents évitent les flottants', () => {
    expect(toCents(1.5)).toBe(150);
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
    expect(fromCents(150)).toBe(1.5);
  });

  it('addCents / subtractCents', () => {
    expect(addCents(150, 250)).toBe(400);
    expect(subtractCents(400, 150)).toBe(250);
  });

  it('applyOdds arrondit le gain au centime', () => {
    expect(applyOdds(1000, 1.85)).toBe(1850);
    expect(applyOdds(333, 1.5)).toBe(500); // 499.5 -> 500
  });

  it('formatEuros renvoie une chaîne formatée', () => {
    expect(typeof formatEuros(150)).toBe('string');
    expect(formatEuros(150)).toContain('1,50');
  });
});
