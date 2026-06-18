import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BetNextLoggerService } from '@betnext/observability';

/**
 * notification-service (Lot 7 — stub T7.1). Process autonome qui consomme la
 * queue BullMQ `notification` ; pour la version école, le worker se contente
 * de journaliser les envois (mails/push mockés). Expose `GET /health` pour
 * que le gateway puisse le superviser au Lot 7.3.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(new BetNextLoggerService('notification-service'));
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('NOTIFICATION_SERVICE_PORT') ?? 3006);
  // T12.4 — documentation OpenAPI/Swagger (dev) : /docs (UI) et /docs-json.
  if (process.env.NODE_ENV !== 'production') {
    const openApi = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BetNext — Notification Service')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, openApi);
  }

  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
