import { EventStatus } from '@betnext/shared-types';
import { acceptsBets, canDelete, canModify, canTransition, nextStatuses } from './event-lifecycle';

describe('event lifecycle', () => {
  it('autorise les transitions du cycle nominal', () => {
    expect(canTransition(EventStatus.BROUILLON, EventStatus.PUBLIE)).toBe(true);
    expect(canTransition(EventStatus.PUBLIE, EventStatus.FERME)).toBe(true);
    expect(canTransition(EventStatus.FERME, EventStatus.TERMINE)).toBe(true);
  });

  it('autorise ANNULE depuis BROUILLON et PUBLIE uniquement', () => {
    expect(canTransition(EventStatus.BROUILLON, EventStatus.ANNULE)).toBe(true);
    expect(canTransition(EventStatus.PUBLIE, EventStatus.ANNULE)).toBe(true);
    expect(canTransition(EventStatus.FERME, EventStatus.ANNULE)).toBe(false);
    expect(canTransition(EventStatus.TERMINE, EventStatus.ANNULE)).toBe(false);
  });

  it('refuse les transitions illégales (saut / retour arrière)', () => {
    expect(canTransition(EventStatus.BROUILLON, EventStatus.FERME)).toBe(false);
    expect(canTransition(EventStatus.BROUILLON, EventStatus.TERMINE)).toBe(false);
    expect(canTransition(EventStatus.PUBLIE, EventStatus.BROUILLON)).toBe(false);
    expect(canTransition(EventStatus.TERMINE, EventStatus.PUBLIE)).toBe(false);
  });

  it('les états terminaux n’ont aucune suite', () => {
    expect(nextStatuses(EventStatus.TERMINE)).toEqual([]);
    expect(nextStatuses(EventStatus.ANNULE)).toEqual([]);
    expect(nextStatuses(EventStatus.BROUILLON)).toEqual([EventStatus.PUBLIE, EventStatus.ANNULE]);
  });

  it('modification / suppression réservées à BROUILLON', () => {
    expect(canModify(EventStatus.BROUILLON)).toBe(true);
    expect(canDelete(EventStatus.BROUILLON)).toBe(true);
    for (const s of [
      EventStatus.PUBLIE,
      EventStatus.FERME,
      EventStatus.TERMINE,
      EventStatus.ANNULE,
    ]) {
      expect(canModify(s)).toBe(false);
      expect(canDelete(s)).toBe(false);
    }
  });

  it('paris ouverts uniquement en PUBLIE', () => {
    expect(acceptsBets(EventStatus.PUBLIE)).toBe(true);
    for (const s of [
      EventStatus.BROUILLON,
      EventStatus.FERME,
      EventStatus.TERMINE,
      EventStatus.ANNULE,
    ]) {
      expect(acceptsBets(s)).toBe(false);
    }
  });
});
