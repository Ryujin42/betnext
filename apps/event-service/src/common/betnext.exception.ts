import { HttpException } from '@nestjs/common';
import type { BetNextErrorCode } from '@betnext/shared-types';

/**
 * Exception métier transportant un {@link BetNextErrorCode}, un statut HTTP
 * et un contexte optionnel. Captée par le filtre global (cf. CONTEXT §13).
 */
export class BetNextException extends HttpException {
  constructor(
    public readonly errorCode: BetNextErrorCode,
    statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ errorCode, message, details }, statusCode);
  }
}
