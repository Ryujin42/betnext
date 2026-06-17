import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

/**
 * notification-service (Lot 7 — stub T7.1). Process autonome qui consomme la
 * queue BullMQ `notification` ; pour la version école, le worker se contente
 * de journaliser les envois (mails/push mockés). Expose `GET /health` pour
 * que le gateway puisse le superviser au Lot 7.3.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('NOTIFICATION_SERVICE_PORT') ?? 3006);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
