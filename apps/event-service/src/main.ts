import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BetNextLoggerService } from '@betnext/observability';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(new BetNextLoggerService('event-service'));
  await app.register(helmet);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('EVENT_SERVICE_PORT') ?? 3002);
  // T12.4 — documentation OpenAPI/Swagger (dev) : /docs (UI) et /docs-json.
  if (process.env.NODE_ENV !== 'production') {
    const openApi = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BetNext — Event Service')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, openApi);
  }

  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
