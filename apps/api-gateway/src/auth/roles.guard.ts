import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { BetNextErrorCode, type Role } from '@betnext/shared-types';
import { BetNextException } from '../common/exceptions/betnext.exception';
import type { AuthenticatedUser } from './jwt.strategy';
import { ROLES_METADATA } from './roles.decorator';

/**
 * Vérifie que `req.user.role` est dans la liste des rôles requis posée par
 * `@Roles(...)`. À utiliser après {@link JwtAuthGuard} dans la chaîne
 * `@UseGuards(JwtAuthGuard, RolesGuard)`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user || !required.includes(user.role)) {
      throw new BetNextException(
        BetNextErrorCode.INVALID_CREDENTIALS,
        HttpStatus.FORBIDDEN,
        'Accès interdit pour ce rôle.',
        { requiredRoles: required, actualRole: user?.role ?? null },
      );
    }
    return true;
  }
}
