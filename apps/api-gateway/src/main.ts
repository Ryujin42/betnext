import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { BetNextLoggerService } from '@betnext/observability';
import { registerBullBoard } from './bullboard/bullboard';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(new BetNextLoggerService('api-gateway'));
  const config = app.get(ConfigService);

  // Helmet : headers HTTP de sécurité (XSS, clickjacking, sniffing).
  await app.register(helmet);

  // Lot 9 T9.3 — Socket.IO attaché au même serveur HTTP que Fastify
  // (handshake JWT côté `RealtimeGateway`). Lot 12 T12.2 : en multi-instance
  // (`EVENT_BUS_DRIVER=redis`), on branche l'adaptateur Redis pour que les
  // salles/broadcasts soient cohérents entre réplicas ; sinon adaptateur local.
  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl && config.get<string>('EVENT_BUS_DRIVER') === 'redis') {
    const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  } else {
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  // Dashboard BullMQ (Lot 7) — exposé en dev si `BULLBOARD_ENABLED=true`.
  await registerBullBoard(app);

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
