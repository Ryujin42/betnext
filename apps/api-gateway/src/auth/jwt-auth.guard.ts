import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BetNextErrorCode } from '@betnext/shared-types';
import { BetNextException } from '../common/exceptions/betnext.exception';

/**
 * Garde JWT principale du gateway (cf. T2.4). Convertit toute erreur
 * Passport en BetNextException pour rester aligné sur le format d'erreur
 * uniforme.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser>(err: unknown, user: TUser | false, info: unknown): TUser {
    if (err || !user) {
      const isExpired = info instanceof Error && info.name === 'TokenExpiredError';
      throw new BetNextException(
        isExpired ? BetNextErrorCode.TOKEN_EXPIRED : BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        isExpired ? 'Access token expiré.' : 'Authentification requise.',
      );
    }
    return user;
  }
}
