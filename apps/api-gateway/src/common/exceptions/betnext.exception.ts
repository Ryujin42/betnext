import { HttpException } from '@nestjs/common';
import type { BetNextErrorCode } from '@betnext/shared-types';

/**
 * Exception métier transportant un {@link BetNextErrorCode}.
 * Identique à celle du user-service — on duplique volontairement pour ne
 * pas créer une dépendance NestJS dans les libs partagées (cf. ADR-002).
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
