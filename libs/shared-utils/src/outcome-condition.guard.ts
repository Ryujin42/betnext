import { BetNextErrorCode, type OutcomeCondition } from '@betnext/shared-types';
import { BetNextError } from './errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isComparisonOperator(value: unknown): value is 'LESS_THAN' | 'GREATER_THAN' {
  return value === 'LESS_THAN' || value === 'GREATER_THAN';
}

/**
 * Type guard runtime pour le champ JSON `outcomes.condition` (cf. ADR-007).
 * Valide la structure selon le discriminant `type`, sans dépendre de la base.
 * Utilisé par la création d'outcomes (T4.3) pour rejeter un `condition` mal formé.
 */
export function isValidOutcomeCondition(value: unknown): value is OutcomeCondition {
  if (!isRecord(value)) {
    return false;
  }
  switch (value.type) {
    case 'TEAM_WINS':
      return true;
    case 'MATCH_DURATION':
      return (
        isComparisonOperator(value.operator) &&
        typeof value.threshold === 'number' &&
        value.unit === 'minutes'
      );
    case 'TOTAL_KILLS':
      return isComparisonOperator(value.operator) && typeof value.threshold === 'number';
    case 'FIRST_BLOOD':
      return typeof value.eventPlayerId === 'number';
    default:
      return false;
  }
}

/**
 * Variante stricte : renvoie la condition typée ou lève une `BetNextError`
 * (`VALIDATION_ERROR`) si la structure est invalide.
 */
export function assertOutcomeCondition(value: unknown): OutcomeCondition {
  if (!isValidOutcomeCondition(value)) {
    throw new BetNextError(
      BetNextErrorCode.VALIDATION_ERROR,
      "Structure de `condition` d'outcome invalide.",
      { value },
    );
  }
  return value;
}
