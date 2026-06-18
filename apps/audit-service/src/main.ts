import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { BetNextLoggerService } from '@betnext/observability';

/**
 * audit-service (Lot 11 — T11.1). Process autonome qui consomme les événements
 * sensibles du bus et les inscrit dans `audit_logs` (append-only). Expose
 * `GET /health` pour la supervision et `GET /audit` en lecture seule.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(new BetNextLoggerService('audit-service'));
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('AUDIT_SERVICE_PORT') ?? 3007);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
