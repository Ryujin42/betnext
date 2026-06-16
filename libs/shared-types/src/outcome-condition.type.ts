/**
 * Type de pari porté par le champ JSON `outcomes.condition` (cf. ADR-007).
 * Discriminated union : le champ `type` pilote la logique de résolution
 * (switch côté betting-service). Ajouter un type = ajouter un membre ici
 * + un cas dans le switch, sans toucher au reste (Open/Closed).
 */
export type OutcomeCondition =
  | { type: 'TEAM_WINS' }
  | {
      type: 'MATCH_DURATION';
      operator: 'LESS_THAN' | 'GREATER_THAN';
      threshold: number;
      unit: 'minutes';
    }
  | { type: 'TOTAL_KILLS'; operator: 'LESS_THAN' | 'GREATER_THAN'; threshold: number }
  | { type: 'FIRST_BLOOD'; eventPlayerId: number };

/** Discriminant utilisable pour les switch exhaustifs. */
export type OutcomeConditionType = OutcomeCondition['type'];
