import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { BetNextLoggerService } from '@betnext/observability';
import { registerBullBoard } from './bullboard/bullboard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(new BetNextLoggerService('api-gateway'));

  // Helmet : headers HTTP de sécurité (XSS, clickjacking, sniffing).
  await app.register(helmet);

  // Lot 9 T9.3 — Socket.IO attaché au même serveur HTTP que Fastify
  // (handshake JWT côté `RealtimeGateway`).
  app.useWebSocketAdapter(new IoAdapter(app));

  // Dashboard BullMQ (Lot 7) — exposé en dev si `BULLBOARD_ENABLED=true`.
  await registerBullBoard(app);

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
