import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from '@betnext/database';
import { MessagingModule } from '@betnext/shared-events';
import { BetNextExceptionFilter } from './common/betnext-exception.filter';
import { HealthController } from './health.controller';
import { AuditModule } from './audit/audit.module';

/**
 * audit-service (T11.1) — consommateur du bus dédié à la traçabilité ARJEL.
 *
 * `MessagingModule.forRoot()` lit `EVENT_BUS_DRIVER` : en production il **doit**
 * valoir `redis` pour que les événements émis par les autres services
 * (betting/wallet/user/event) parviennent ici. La connexion TypeORM ne sert
 * qu'à insérer dans `audit_logs` (append-only).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    MessagingModule.forRoot(),
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
