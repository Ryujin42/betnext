import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BetNextErrorCode, Role } from '@betnext/shared-types';
import { BetNextException } from './betnext.exception';

/**
 * Restreint l'accès aux gestionnaires (ROLE_MANAGER) et admins. À placer
 * APRÈS {@link InternalAuthGuard} : `@UseGuards(InternalAuthGuard, ManagerGuard)`.
 * Le contrôle de rôle a déjà lieu au gateway (`@Roles`) ; ceci est une
 * vérification de défense en profondeur côté service.
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
