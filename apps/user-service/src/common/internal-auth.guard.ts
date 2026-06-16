import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { BetNextException } from './exceptions/betnext.exception';

export interface InternalUser {
  id: number;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    internalUser?: InternalUser;
  }
}

/**
 * Garde des routes internes du user-service : exige que le gateway ait
 * vérifié le JWT et injecté `x-user-id` + `x-user-role` (T2.4).
 *
 * En production, le user-service serait sur réseau interne, inaccessible
 * sans passer par le gateway. Cette garde est une ceinture-bretelles.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const idRaw = req.headers['x-user-id'];
    const roleRaw = req.headers['x-user-role'];
    if (typeof idRaw !== 'string' || typeof roleRaw !== 'string') {
      throw new BetNextException(
        BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        'Headers internes manquants (x-user-id / x-user-role).',
      );
    }
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(id)) {
      throw new BetNextException(
        BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        'x-user-id invalide.',
      );
    }
    const role = Object.values(Role).includes(roleRaw as Role) ? (roleRaw as Role) : null;
    if (!role) {
      throw new BetNextException(
        BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        'x-user-role invalide.',
      );
    }
    req.internalUser = { id, role };
    return true;
  }
}
