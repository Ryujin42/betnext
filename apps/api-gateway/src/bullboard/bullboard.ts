import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { BetNextQueue } from '@betnext/shared-events';
import { Role } from '@betnext/shared-types';

const BASE_PATH = '/admin/queues';

interface BetNextJwtPayload {
  sub?: number;
  role?: string;
}

/**
 * Dashboard BullMQ (T7.1) — supervision en dev des 3 queues du Lot 7. Monté
 * comme plugin Fastify directement (bull-board ne s'exprime pas en
 * contrôleur Nest). Activé uniquement si `BULLBOARD_ENABLED=true` ;
 * l'accès est restreint à `ROLE_ADMIN` via un `preHandler` qui vérifie le
 * JWT manuellement (cookie ou query `?token=…` pour faciliter le debug
 * dans un navigateur, sinon header `Authorization`).
 */
export async function registerBullBoard(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService);
  if (config.get<string>('BULLBOARD_ENABLED') !== 'true') {
    return;
  }
  const redisUrl = config.get<string>('REDIS_URL');
  if (!redisUrl) {
    throw new Error('BULLBOARD_ENABLED=true : REDIS_URL est requis.');
  }

  const logger = new Logger('BullBoard');
  const jwt = app.get(JwtService);
  const queues = [
    new Queue(BetNextQueue.BetResolution, { connection: { url: redisUrl } }),
    new Queue(BetNextQueue.PaymentWebhook, { connection: { url: redisUrl } }),
    new Queue(BetNextQueue.Notification, { connection: { url: redisUrl } }),
  ];

  const serverAdapter = new BullBoardFastifyAdapter();
  serverAdapter.setBasePath(BASE_PATH);
  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(serverAdapter.registerPlugin(), { prefix: BASE_PATH });
  fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith(BASE_PATH)) {
      return;
    }
    const token = extractToken(req);
    if (!token) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    try {
      const payload = await jwt.verifyAsync<BetNextJwtPayload>(token);
      if (payload.role !== Role.ADMIN) {
        await reply.code(403).send({ error: 'Forbidden' });
      }
    } catch {
      await reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  logger.log(`Dashboard BullMQ exposé sur ${BASE_PATH} (ROLE_ADMIN requis).`);
}

function extractToken(req: FastifyRequest): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  const query = req.query as Record<string, unknown> | undefined;
  const queryToken = query?.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }
  return null;
}
