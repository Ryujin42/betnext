import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * Extrait `req.user` injecté par {@link JwtAuthGuard}. À utiliser dans les
 * contrôleurs protégés du gateway.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthenticatedUser }>();
    return req.user;
  },
);
