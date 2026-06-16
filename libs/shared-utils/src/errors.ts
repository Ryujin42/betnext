import type { BetNextErrorCode } from '@betnext/shared-types';

/**
 * Erreur métier transportant un {@link BetNextErrorCode} et un contexte
 * optionnel. L'import de `@betnext/shared-types` ici prouve la résolution
 * inter-paquets du workspace (DoD T1.2).
 */
export class BetNextError extends Error {
  constructor(
    public readonly code: BetNextErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BetNextError';
  }
}
