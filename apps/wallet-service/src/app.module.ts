import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from '@betnext/database';
import { MessagingModule } from '@betnext/shared-events';
import { BetNextExceptionFilter } from './common/betnext-exception.filter';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    MessagingModule.forRoot(),
    WalletModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
