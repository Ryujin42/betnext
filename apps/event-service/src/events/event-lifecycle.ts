import { EventStatus } from '@betnext/shared-types';

/**
 * Machine à états du cycle de vie d'un événement (cf. BETNEXT_CONTEXT §10).
 *
 *   BROUILLON → PUBLIE → FERME → TERMINE
 *   BROUILLON / PUBLIE → ANNULE
 *
 * Logique pure (sans BDD ni HTTP) : la couche service s'appuie dessus pour
 * autoriser ou refuser une transition / suppression / ouverture des paris.
 */
const ALLOWED_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  [EventStatus.BROUILLON]: [EventStatus.PUBLIE, EventStatus.ANNULE],
  [EventStatus.PUBLIE]: [EventStatus.FERME, EventStatus.ANNULE],
  [EventStatus.FERME]: [EventStatus.TERMINE],
  [EventStatus.TERMINE]: [],
  [EventStatus.ANNULE]: [],
};

/** Vrai si la transition `from → to` est autorisée. */
export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuts atteignables depuis `from`. */
export function nextStatuses(from: EventStatus): EventStatus[] {
  return [...ALLOWED_TRANSITIONS[from]];
}

/** Un événement n'est modifiable / supprimable qu'en BROUILLON. */
export function canModify(status: EventStatus): boolean {
  return status === EventStatus.BROUILLON;
}

export function canDelete(status: EventStatus): boolean {
  return status === EventStatus.BROUILLON;
}

/** Les paris ne sont ouverts qu'en PUBLIE. */
export function acceptsBets(status: EventStatus): boolean {
  return status === EventStatus.PUBLIE;
}
