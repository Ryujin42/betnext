import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from '@betnext/database';
import { AdaptersModule } from './adapters/adapters.module';
import { BetNextExceptionFilter } from './common/betnext-exception.filter';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    AdaptersModule,
    EventsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
