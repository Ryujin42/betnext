import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from '@betnext/database';
import { MessagingModule } from '@betnext/shared-events';
import { OddsModule } from '@betnext/odds';
import { HealthController } from './health/health.controller';

/**
 * odds-engine (T5.2) — consommateur des cotes. Importe la `MessagingModule`
 * (bus + verrou) et l'`OddsModule` qui s'abonne à `bet.placed` et recalcule
 * sous verrou distribué. Au Lot 7, le bus in-memory devient Redis/BullMQ.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    MessagingModule,
    OddsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
