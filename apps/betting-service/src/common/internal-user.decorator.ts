import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { InternalUser } from './internal-auth.guard';

/** Récupère `req.internalUser` posé par {@link InternalAuthGuard}. */
export const Internal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): InternalUser => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!req.internalUser) {
      throw new Error('InternalUser absent — la garde InternalAuthGuard est-elle appliquée ?');
    }
    return req.internalUser;
  },
);
