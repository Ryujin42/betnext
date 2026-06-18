import { BetNextTopic } from '@betnext/shared-events';

/**
 * Topics du bus considérés comme **sensibles** au sens ARJEL : chacun produit
 * une ligne d'audit immuable (T11.1). On audite les actions métier (paris,
 * mouvements de portefeuille, jeu responsable, suspension), pas les événements
 * purement techniques comme `odds.updated` (qui relèvent du monitoring).
 *
 * Pour ajouter un nouvel événement auditable, il suffit de l'ajouter ici — le
 * subscriber et l'extraction des champs sont génériques.
 */
export const AUDITED_TOPICS: readonly string[] = [
  BetNextTopic.BetPlaced,
  BetNextTopic.BetWon,
  BetNextTopic.BetLost,
  BetNextTopic.PaymentDeposited,
  BetNextTopic.PaymentWithdrawn,
  BetNextTopic.RgLimitUpdated,
  BetNextTopic.RgSelfExcluded,
  BetNextTopic.UserSuspended,
  BetNextTopic.UserUnsuspended,
  BetNextTopic.EventResultSet,
];

/** Champs normalisés extraits d'un événement pour l'indexation de l'audit. */
export interface AuditFields {
  /** Utilisateur sujet de l'action (`payload.userId`), sinon `null`. */
  userId: number | null;
  /** Acteur déclencheur si distinct du sujet (`payload.adminId` / `actorId`), sinon `null`. */
  actorId: number | null;
  /** Horodatage métier (`payload.occurredAt`), sinon l'instant courant. */
  occurredAt: Date;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Extrait de façon générique les champs indexés d'un payload d'événement.
 * Volontairement tolérant : l'audit doit tracer même un payload partiel plutôt
 * que de perdre l'information. Le payload complet est conservé tel quel à côté.
 */
export function extractAuditFields(payload: Record<string, unknown>): AuditFields {
  const occurredAtRaw = payload['occurredAt'];
  const occurredAt =
    typeof occurredAtRaw === 'string' && !Number.isNaN(Date.parse(occurredAtRaw))
      ? new Date(occurredAtRaw)
      : new Date();

  return {
    userId: asNumber(payload['userId']),
    actorId: asNumber(payload['adminId']) ?? asNumber(payload['actorId']),
    occurredAt,
  };
}
