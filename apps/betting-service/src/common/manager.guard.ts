import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { BetNextException } from './betnext.exception';

/**
 * Restreint l'accès aux gestionnaires (ROLE_MANAGER) et admins. À placer
 * APRÈS {@link InternalAuthGuard}. Utilisée pour le déclenchement interne de
 * la résolution des paris (réservé au système / gestionnaire).
 */
@Injectable()
export class ManagerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const role = req.internalUser?.role;
    if (role !== Role.MANAGER && role !== Role.ADMIN) {
      throw new BetNextException(
        BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.FORBIDDEN,
        'Accès réservé aux gestionnaires.',
        { actualRole: role ?? null },
      );
    }
    return true;
  }
}
