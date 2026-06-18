import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { BetNextLoggerService } from '@betnext/observability';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(new BetNextLoggerService('odds-engine'));
  await app.register(helmet);

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('ODDS_ENGINE_PORT') ?? 3004);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
