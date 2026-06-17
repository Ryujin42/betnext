import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from '@betnext/database';
import { MessagingModule } from '@betnext/shared-events';
import { OddsModule } from '@betnext/odds';
import { BetNextExceptionFilter } from './common/betnext-exception.filter';
import { BetsModule } from './bets/bets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    MessagingModule,
    // Lot 5 : recalcul des cotes in-process (bus in-memory mono-processus).
    // Au Lot 7, ce recalcul migre vers l'odds-engine via le bus Redis.
    OddsModule,
    BetsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
