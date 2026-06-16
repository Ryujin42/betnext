import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(helmet);

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('EVENT_SERVICE_PORT') ?? 3002);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
