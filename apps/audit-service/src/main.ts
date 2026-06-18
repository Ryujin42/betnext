import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  // T12.4 — documentation OpenAPI/Swagger (dev) : /docs (UI) et /docs-json.
  if (process.env.NODE_ENV !== 'production') {
    const openApi = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BetNext — Audit Service')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, openApi);
  }

  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
