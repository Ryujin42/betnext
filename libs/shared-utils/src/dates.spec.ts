import { addHours, hoursUntil, isAdult, isPast } from './dates';

// On construit les dates en heure locale (new Date(y, mIndex, d)) pour rester
// indépendant du fuseau horaire de la machine de test.
describe('dates', () => {
  const ref = new Date(2026, 5, 16, 12, 0, 0); // 16 juin 2026, midi (local)

  it('isAdult: exactement 18 ans -> true', () => {
    expect(isAdult(new Date(2008, 5, 16), ref)).toBe(true);
  });

  it('isAdult: anniversaire le lendemain -> false', () => {
    expect(isAdult(new Date(2008, 5, 17), ref)).toBe(false);
  });

  it('isAdult: 17 ans -> false', () => {
    expect(isAdult(new Date(2009, 0, 1), ref)).toBe(false);
  });

  it('addHours ajoute le bon delta', () => {
    const base = new Date(2026, 5, 16, 0, 0, 0);
    expect(addHours(base, 48).getTime() - base.getTime()).toBe(48 * 3_600_000);
  });

  it('isPast', () => {
    expect(isPast(new Date(2020, 0, 1), ref)).toBe(true);
    expect(isPast(new Date(2030, 0, 1), ref)).toBe(false);
  });

  it('hoursUntil', () => {
    const future = new Date(ref.getTime() + 6 * 3_600_000);
    expect(hoursUntil(future, ref)).toBeCloseTo(6);
  });
});
