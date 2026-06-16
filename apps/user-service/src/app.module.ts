import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BetNextExceptionFilter } from './common/exceptions/betnext-exception.filter';
import { databaseConfigFactory } from './config/database.config';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
